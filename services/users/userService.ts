"use client";

import type { User } from "firebase/auth";
import { COLLECTIONS } from "@/constants/firestore";
import type { ConsumerRegistration, UserProfile } from "@/features/auth/contracts";
import { isBootstrapAdminEmail } from "@/features/auth/bootstrap";
import { AuthenticationError } from "@/features/auth/errors";
import { parseUserProfile } from "@/features/auth/profile";
import {
  firestoreTimestamp,
  readDocument,
  runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import {
  createAuditedDocument,
  getAuditActorId,
  updateAuditedDocument,
} from "@/services/firestore/auditService";

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
    .then(async (existingDocument) => {
      let document = existingDocument;
      if (!document && isBootstrapAdminEmail(fallbackEmail)) {
        await createAuditedDocument(COLLECTIONS.users, {
          uid,
          name: "Ayursarga Admin",
          email: fallbackEmail.trim().toLowerCase(),
          phone: null,
          role: "admin",
          status: "active",
          hospitalId: null,
          createdAt: firestoreTimestamp.server(),
          createdBy: uid,
          updatedAt: firestoreTimestamp.server(),
          updatedBy: uid,
          archivedAt: null,
          archivedBy: null,
        }, { action: "create", actorRole: "admin" }, uid);
        document = await readDocument<Record<string, unknown>>(COLLECTIONS.users, uid);
      }
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
  await createAuditedDocument(COLLECTIONS.users, {
    uid: user.uid,
    name,
    email: user.email ?? input.email.trim(),
    phone: input.phone?.trim() || null,
    role: "consumer",
    status: "active",
    hospitalId: null,
    createdAt: firestoreTimestamp.server(),
    createdBy: user.uid,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: user.uid,
    archivedAt: null,
    archivedBy: null,
  }, { action: "create", actorRole: "consumer" }, user.uid);

  return getUserProfile(user.uid, user.email ?? input.email.trim(), true);
}

export async function updateUserProfile(
  uid: string,
  changes: { name?: string; phone?: string | null },
) {
  const allowedChanges: Record<string, unknown> = {
    updatedAt: firestoreTimestamp.server(),
    updatedBy: uid,
  };
  if (typeof changes.name === "string") allowedChanges.name = changes.name.trim();
  if (changes.phone !== undefined) allowedChanges.phone = changes.phone?.trim() || null;
  const role = profileCache.get(uid)?.role ?? "consumer";
  await updateAuditedDocument(COLLECTIONS.users, uid, allowedChanges, { action: "update", actorRole: role });
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

export function listUsers(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<Record<string, unknown>>({
    collectionPath: COLLECTIONS.users,
    sort: { field: "createdAt", direction: "desc" },
    ...options,
  });
}

export const archiveUser = (uid: string) => updateAuditedDocument(COLLECTIONS.users, uid, {
  status: "archived", archivedAt: firestoreTimestamp.server(), archivedBy: getAuditActorId(),
  updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
}, { action: "archive", actorRole: "admin" });

export const restoreUser = (uid: string) => updateAuditedDocument(COLLECTIONS.users, uid, {
  status: "inactive", archivedAt: null, archivedBy: null,
  updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
}, { action: "restore", actorRole: "admin" });
