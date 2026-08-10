"use client";

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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
import {
  clearUserProfileCache,
  createGoogleConsumerProfile,
  getUserProfile,
} from "@/services/users/userService";

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

async function loginConsumerWithGoogle() {
  try {
    const credential = await signInWithPopup(getClientAuth(), new GoogleAuthProvider());
    let profile;
    try {
      profile = await getUserProfile(credential.user.uid, credential.user.email ?? "", true);
    } catch (error) {
      if (!(error instanceof AuthenticationError) || error.code !== "profile-not-found") throw error;
      profile = await createGoogleConsumerProfile(credential.user);
    }
    return verifyProfileRole(profile, "consumer");
  } catch (error) {
    await signOut(getClientAuth()).catch(() => undefined);
    throw toAuthenticationError(error);
  }
}

export const authService: AuthAdapter = {
  login,
  loginConsumerWithGoogle,
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
      return await getUserProfile(user.uid, user.email ?? "", force);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  subscribe(listener, onError) {
    return subscribeToAuthProfile(listener, onError);
  },
};
