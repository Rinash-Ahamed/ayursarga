"use client";

import { onIdTokenChanged, type User } from "firebase/auth";
import type { AuthSnapshot, AuthUser } from "@/features/auth/contracts";
import { toAuthenticationError } from "@/features/auth/errors";
import { verifyProfileRole } from "@/features/auth/roles";
import { getClientAuth } from "@/services/auth/client";
import { assertAdminMfaSession } from "@/services/auth/adminMfaService";

export async function loadAuthorizedProfile(user: User) {
  const { getUserProfile } = await import("@/services/users/userService");
  const profile = await getUserProfile(user.uid, user.email ?? "");
  verifyProfileRole(profile, profile.role);
  if (profile.role === "admin") await assertAdminMfaSession(user);
  return profile;
}

export function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

export function subscribeToAuthProfile(
  listener: (snapshot: AuthSnapshot) => void,
  onError: (error: Error) => void,
) {
  let revision = 0;
  let active = true;
  try {
    const unsubscribe = onIdTokenChanged(getClientAuth(), (user) => {
      const currentRevision = ++revision;
      if (!user) {
        listener({ user: null, profile: null });
        return;
      }
      void loadAuthorizedProfile(user)
        .then((profile) => { if (active && revision === currentRevision) listener({ user: toAuthUser(user), profile }); })
        .catch((error) => {
          if (!active || revision !== currentRevision) return;
          listener({ user: toAuthUser(user), profile: null });
          onError(toAuthenticationError(error));
        });
    }, (error) => { if (active) onError(toAuthenticationError(error)); });
    return () => { active = false; revision++; unsubscribe(); };
  } catch (error) {
    queueMicrotask(() => onError(toAuthenticationError(error)));
    return () => undefined;
  }
}
