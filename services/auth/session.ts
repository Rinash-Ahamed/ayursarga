"use client";

import { onIdTokenChanged, type User } from "firebase/auth";
import type { AuthSnapshot, AuthUser } from "@/features/auth/contracts";
import { toAuthenticationError } from "@/features/auth/errors";
import { verifyProfileRole } from "@/features/auth/roles";
import { getClientAuth } from "@/services/auth/client";

export async function loadAuthorizedProfile(user: User) {
  const { getUserProfile } = await import("@/services/users/userService");
  const profile = await getUserProfile(user.uid, user.email ?? "");
  return verifyProfileRole(profile, profile.role);
}

export function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}

export function subscribeToAuthProfile(
  listener: (snapshot: AuthSnapshot) => void,
  onError: (error: Error) => void,
) {
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
}
