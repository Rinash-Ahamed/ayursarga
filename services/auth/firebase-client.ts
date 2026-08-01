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
import { doc, getDoc, setDoc } from "firebase/firestore";
import type {
  AuthAdapter,
  AuthUser,
  ConsumerRegistration,
  PortalRole,
  UserProfile,
} from "@/features/auth/contracts";
import { AuthenticationError, toAuthenticationError } from "@/features/auth/errors";
import { parseUserProfile } from "@/features/auth/profile";
import { isPortalRole, verifyProfileRole } from "@/features/auth/roles";
import { getClientAuth } from "@/services/auth/client";
import { getClientFirestore } from "@/services/firestore/client";

const USERS_COLLECTION = "users";

const toAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  emailVerified: user.emailVerified,
});

async function getUserProfile(user: User): Promise<UserProfile> {
  const snapshot = await getDoc(doc(getClientFirestore(), USERS_COLLECTION, user.uid));
  if (!snapshot.exists()) throw new AuthenticationError("profile-not-found");

  const profile = parseUserProfile(user.uid, snapshot.data(), user.email ?? "");
  const token = await user.getIdTokenResult();
  const claimRole = isPortalRole(token.claims.role) ? token.claims.role : null;

  // Privileged roles must be issued as signed custom claims by the Admin SDK.
  if (profile.role !== "consumer" && claimRole !== profile.role) {
    throw new AuthenticationError("role-mismatch");
  }
  if (claimRole && claimRole !== profile.role) throw new AuthenticationError("role-mismatch");
  if (profile.status === "suspended") throw new AuthenticationError("account-suspended");

  return profile;
}

async function login(credentials: { email: string; password: string }, expectedRole?: PortalRole) {
  try {
    const credential = await signInWithEmailAndPassword(
      getClientAuth(),
      credentials.email.trim(),
      credentials.password,
    );
    try {
      const profile = await getUserProfile(credential.user);
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
    const credential = await createUserWithEmailAndPassword(
      getClientAuth(),
      input.email.trim(),
      input.password,
    );
    user = credential.user;
    const displayName = input.displayName.trim();
    const timestamp = new Date().toISOString();

    await updateProfile(user, { displayName });
    await setDoc(doc(getClientFirestore(), USERS_COLLECTION, user.uid), {
      uid: user.uid,
      email: user.email ?? input.email.trim(),
      displayName,
      role: "consumer",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies UserProfile);

    return getUserProfile(user);
  } catch (error) {
    if (user) await deleteUser(user).catch(() => undefined);
    throw toAuthenticationError(error);
  }
}

export const firebaseAuthAdapter: AuthAdapter = {
  login,
  registerConsumer,
  async logout() {
    try {
      await signOut(getClientAuth());
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
  async getCurrentProfile() {
    const user = getClientAuth().currentUser;
    if (!user) return null;
    try {
      return await getUserProfile(user);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  subscribe(listener, onError) {
    return onIdTokenChanged(getClientAuth(), (user) => {
      if (!user) {
        listener({ user: null, profile: null });
        return;
      }

      void getUserProfile(user)
        .then((profile) => listener({ user: toAuthUser(user), profile }))
        .catch((error) => {
          listener({ user: toAuthUser(user), profile: null });
          onError(toAuthenticationError(error));
        });
    }, (error) => onError(toAuthenticationError(error)));
  },
};
