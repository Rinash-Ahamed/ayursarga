"use client";

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
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
import { assertAdminMfaSession, captureAdminMfaChallenge, clearAdminMfaState, enrollAdminMfa, isNativeMfaChallenge, resolveAdminMfaChallenge, resolveMfaReauthentication } from "@/services/auth/adminMfaService";

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

async function finishPasswordLogin(user: User, expectedRole?: PortalRole) {
  try {
    let profile;
    try {
      profile = await loadAuthorizedProfile(user);
    } catch (error) {
      const profileError = toAuthenticationError(error);
      if (expectedRole !== "admin" || profileError.code !== "profile-not-found") throw error;
      await restoreMissingAdminProfile(user);
      profile = await loadAuthorizedProfile(user);
    }
    return expectedRole ? verifyProfileRole(profile, expectedRole) : profile;
  } catch (error) {
    // An unenrolled Admin has only a password session for the narrow setup flow.
    // APIs/rules still deny every operational Admin action.
    if (expectedRole !== "admin" || toAuthenticationError(error).code !== "mfa-enrollment-required") {
      await signOut(getClientAuth());
      clearAdminMfaState();
    }
    throw error;
  }
}

async function login(credentials: LoginCredentials, expectedRole?: PortalRole) {
  clearAdminMfaState();
  try {
    const credential = await signInWithEmailAndPassword(
      getClientAuth(),
      credentials.email.trim(),
      credentials.password,
    );
    return await finishPasswordLogin(credential.user, expectedRole);
  } catch (error) {
    if (expectedRole === "admin" && isNativeMfaChallenge(error)) {
      captureAdminMfaChallenge(error);
      throw new AuthenticationError("mfa-required");
    }
    throw toAuthenticationError(error);
  }
}

async function loginConsumerWithGoogle() {
  clearAdminMfaState();
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
  async completeAdminMfa(code: string) {
    try { return await finishPasswordLogin(await resolveAdminMfaChallenge(code), "admin"); }
    catch (error) { throw toAuthenticationError(error); }
  },
  async completeAdminMfaEnrollment(code: string) {
    try { return await finishPasswordLogin(await enrollAdminMfa(code), "admin"); }
    catch (error) { throw toAuthenticationError(error); }
  },
  loginConsumerWithGoogle,
  async logout() {
    try {
      const uid = getClientAuth().currentUser?.uid;
      clearAdminMfaState();
      await signOut(getClientAuth());
      const { clearUserProfileCache } = await loadUserProfileService();
      clearUserProfileCache(uid);
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  async resetPassword(email: string) {
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }), cache: "no-store",
      });
      const body = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (!response.ok || body?.ok !== true) throw new AuthenticationError(response.status === 429 ? "too-many-requests" : "email-delivery");
    } catch (error) {
      if (error instanceof TypeError) throw new AuthenticationError("network", { cause: error });
      throw toAuthenticationError(error);
    }
  },
  async reauthenticate(currentPassword: string, authenticatorCode?: string) {
    try {
      const user = getClientAuth().currentUser;
      if (!user?.email) throw new AuthenticationError("unauthenticated");
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      } catch (error) {
        if (!isNativeMfaChallenge(error)) throw error;
        await resolveMfaReauthentication(error, authenticatorCode);
      }
      await user.getIdToken(true);
      const { getUserProfile } = await loadUserProfileService();
      const profile = await getUserProfile(user.uid, user.email);
      if (profile.role === "admin") await assertAdminMfaSession(user);
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
      const profile = await getUserProfile(user.uid, user.email ?? "", force);
      if (profile.role === "admin") await assertAdminMfaSession(user);
      return profile;
    } catch (error) {
      throw toAuthenticationError(error);
    }
  },
  subscribe(listener, onError) {
    return subscribeToAuthProfile(listener, onError);
  },
};
