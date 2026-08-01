"use client";

import type { User } from "firebase/auth";
import { COLLECTIONS } from "@/constants/firestore";
import type { ConsumerRegistration, UserProfile } from "@/features/auth/contracts";
import { AuthenticationError } from "@/features/auth/errors";
import { parseUserProfile } from "@/features/auth/profile";
import {
  createDocument,
  firestoreTimestamp,
  readDocument,
  updateDocument,
} from "@/services/firestore/firestoreService";

const profileCache = new Map<string, UserProfile>();
const profileRequests = new Map<string, Promise<UserProfile>>();

export async function getUserProfile(uid: string, fallbackEmail = "", force = false) {
  if (!force) {
    const cached = profileCache.get(uid);
    if (cached) return cached;
    const pending = profileRequests.get(uid);
    if (pending) return pending;
  }

  const request = readDocument<Record<string, unknown>>(COLLECTIONS.users, uid)
    .then((document) => {
      if (!document) throw new AuthenticationError("profile-not-found");
      const profile = parseUserProfile(uid, document, fallbackEmail);
      profileCache.set(uid, profile);
      return profile;
    })
    .finally(() => profileRequests.delete(uid));

  profileRequests.set(uid, request);
  return request;
}

export async function createConsumerProfile(user: User, input: ConsumerRegistration) {
  const name = input.name.trim();
  await createDocument(COLLECTIONS.users, {
    uid: user.uid,
    name,
    email: user.email ?? input.email.trim(),
    phone: input.phone?.trim() || null,
    role: "consumer",
    status: "active",
    hospitalId: null,
    createdAt: firestoreTimestamp.server(),
    updatedAt: firestoreTimestamp.server(),
  }, user.uid);

  return getUserProfile(user.uid, user.email ?? input.email.trim(), true);
}

export async function updateUserProfile(
  uid: string,
  changes: { name?: string; phone?: string | null },
) {
  const allowedChanges: Record<string, unknown> = { updatedAt: firestoreTimestamp.server() };
  if (typeof changes.name === "string") allowedChanges.name = changes.name.trim();
  if (changes.phone !== undefined) allowedChanges.phone = changes.phone?.trim() || null;
  await updateDocument(COLLECTIONS.users, uid, allowedChanges);
  return getUserProfile(uid, "", true);
}

export function clearUserProfileCache(uid?: string) {
  if (uid) {
    profileCache.delete(uid);
    profileRequests.delete(uid);
    return;
  }
  profileCache.clear();
  profileRequests.clear();
}
