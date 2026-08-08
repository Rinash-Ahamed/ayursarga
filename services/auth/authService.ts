"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import type {
  AuthAdapter,
  AuthUser,
  ConsumerRegistration,
  LoginCredentials,
  PortalRole,
} from "@/features/auth/contracts";
import { AuthenticationError, toAuthenticationError } from "@/features/auth/errors";
import { isValidPassword } from "@/features/auth/password";
import { isPortalRole, verifyProfileRole } from "@/features/auth/roles";
import { getClientAuth } from "@/services/auth/client";
import {
  clearUserProfileCache,
  createConsumerProfile,
  getUserProfile,
} from "@/services/users/userService";

const toAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  emailVerified: user.emailVerified,
});

async function loadAuthorizedProfile(user: User) {
  const profile = await getUserProfile(user.uid, user.email ?? "");
  const token = await user.getIdTokenResult();
  const claimRole = isPortalRole(token.claims.role) ? token.claims.role : null;

  if (profile.role !== "consumer" && claimRole !== profile.role) {
    throw new AuthenticationError("role-mismatch");
  }
  if (claimRole && claimRole !== profile.role) throw new AuthenticationError("role-mismatch");
  return verifyProfileRole(profile, profile.role);
}

async function login(credentials: LoginCredentials, expectedRole?: PortalRole) {
  try {
    const credential = await signInWithEmailAndPassword(
      getClientAuth(),
      credentials.email.trim(),
      credentials.password,
    );
    try {
      const profile = await loadAuthorizedProfile(credential.user);
      return expectedRole ? verifyProfileRole(profile, expectedRole) : profile;
    } catch (error) {
      await signOut(getClientAuth());
      throw error;
    }
  } catch (error) {
    throw toAuthenticationError(error);
  }
}

async function registerConsumer(input: ConsumerRegistration) {
  let user: User | null = null;
  try {
    if (!isValidPassword(input.password)) throw new AuthenticationError("weak-password");
    const credential = await createUserWithEmailAndPassword(
      getClientAuth(),
      input.email.trim(),
      input.password,
    );
    user = credential.user;
    await updateProfile(user, { displayName: input.name.trim() });
    return await createConsumerProfile(user, input);
  } catch (error) {
    if (user) await deleteUser(user).catch(() => undefined);
    throw toAuthenticationError(error);
  }
}

export const authService: AuthAdapter = {
  login,
  registerConsumer,
  async logout() {
    try {
      const uid = getClientAuth().currentUser?.uid;
      await signOut(getClientAuth());
      clearUserProfileCache(uid);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim());
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  getCurrentUser() {
    const user = getClientAuth().currentUser;
    return user ? toAuthUser(user) : null;
  },
  async getCurrentProfile(force = false) {
    const user = getClientAuth().currentUser;
    if (!user) return null;
    try {
      return await getUserProfile(user.uid, user.email ?? "", force);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  subscribe(listener, onError) {
    try {
      return onIdTokenChanged(getClientAuth(), (user) => {
        if (!user) {
          listener({ user: null, profile: null });
          return;
        }
        void loadAuthorizedProfile(user)
          .then((profile) => listener({ user: toAuthUser(user), profile }))
          .catch((error) => {
            listener({ user: toAuthUser(user), profile: null });
            onError(toAuthenticationError(error));
          });
      }, (error) => onError(toAuthenticationError(error)));
    } catch (error) {
      queueMicrotask(() => onError(toAuthenticationError(error)));
      return () => undefined;
    }
  },
};
