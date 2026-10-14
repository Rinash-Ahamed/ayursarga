"use client";

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  updatePassword,
} from "firebase/auth";
import type {
  AuthAdapter,
  LoginCredentials,
  PortalRole,
} from "@/features/auth/contracts";
import { AuthenticationError, toAuthenticationError } from "@/features/auth/errors";
import { isValidPassword } from "@/features/auth/password";
import { verifyProfileRole } from "@/features/auth/roles";
import { getClientAuth } from "@/services/auth/client";
import { loadAuthorizedProfile, subscribeToAuthProfile, toAuthUser } from "@/services/auth/session";

async function loadUserProfileService() {
  return import("@/services/users/userService");
}

async function restoreMissingAdminProfile(user: User) {
  const response = await fetch("/api/auth/bootstrap-admin", {
    method: "POST",
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    cache: "no-store",
  });
  if (!response.ok) throw new AuthenticationError("profile-recovery");
  const { clearUserProfileCache } = await loadUserProfileService();
  clearUserProfileCache(user.uid);
}

async function login(credentials: LoginCredentials, expectedRole?: PortalRole) {
  try {
    const credential = await signInWithEmailAndPassword(
      getClientAuth(),
      credentials.email.trim(),
      credentials.password,
    );
    try {
      let profile;
      try {
        profile = await loadAuthorizedProfile(credential.user);
      } catch (error) {
        const profileError = toAuthenticationError(error);
        if (expectedRole !== "admin" || profileError.code !== "profile-not-found") throw error;
        await restoreMissingAdminProfile(credential.user);
        profile = await loadAuthorizedProfile(credential.user);
      }
      return expectedRole ? verifyProfileRole(profile, expectedRole) : profile;
    } catch (error) {
      await signOut(getClientAuth());
      throw error;
    }
  } catch (error) {
    throw toAuthenticationError(error);
  }
}

async function loginConsumerWithGoogle() {
  const auth = getClientAuth();
  const previousUser = auth.currentUser;
  try {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    const { createGoogleConsumerProfile, getUserProfile } = await loadUserProfileService();
    let profile;
    try {
      profile = await getUserProfile(credential.user.uid, credential.user.email ?? "", true);
    } catch (error) {
      if (!(error instanceof AuthenticationError) || error.code !== "profile-not-found") throw error;
      profile = await createGoogleConsumerProfile(credential.user);
    }
    return verifyProfileRole(profile, "consumer");
  } catch (error) {
    const authError = toAuthenticationError(error);
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid !== previousUser?.uid) {
      await signOut(auth).catch(() => undefined);
    }
    throw authError;
  }
}

export const authService: AuthAdapter = {
  login,
  loginConsumerWithGoogle,
  async logout() {
    try {
      const uid = getClientAuth().currentUser?.uid;
      await signOut(getClientAuth());
      const { clearUserProfileCache } = await loadUserProfileService();
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
  async reauthenticate(currentPassword: string) {
    try {
      const user = getClientAuth().currentUser;
      if (!user?.email) throw new AuthenticationError("unauthenticated");
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await user.getIdToken(true);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    try {
      if (!isValidPassword(newPassword)) throw new AuthenticationError("weak-password");
      const user = getClientAuth().currentUser;
      if (!user?.email) throw new AuthenticationError("unauthenticated");
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await updatePassword(user, newPassword);
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
      const { getUserProfile } = await loadUserProfileService();
      return await getUserProfile(user.uid, user.email ?? "", force);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  subscribe(listener, onError) {
    return subscribeToAuthProfile(listener, onError);
  },
};
