"use client";

import type { User } from "firebase/auth";
import { COLLECTIONS } from "@/constants/firestore";
import type { UserProfile } from "@/features/auth/contracts";
import type { UserDocument } from "@/features/firestore/models";
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
  getArchiveMetadata,
  getRestoreMetadata,
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
      let document: Record<string, unknown> | null = existingDocument;
      if (!document && isBootstrapAdminEmail(fallbackEmail)) {
        const bootstrapProfile = {
          uid,
          name: "Ayursarga Admin",
          email: fallbackEmail.trim().toLowerCase(),
          phone: null,
          address: null,
          role: "admin",
          status: "active",
          hospitalId: null,
          createdAt: firestoreTimestamp.server(),
          createdBy: uid,
          updatedAt: firestoreTimestamp.server(),
          updatedBy: uid,
          archivedAt: null,
          archivedBy: null,
        };
        await createAuditedDocument(COLLECTIONS.users, bootstrapProfile, { action: "create", actorRole: "admin" }, uid);
        document = bootstrapProfile;
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

export async function createGoogleConsumerProfile(user: User) {
  const name = user.displayName?.trim() || user.email?.split("@")[0] || "Ayursarga Consumer";
  await createAuditedDocument(COLLECTIONS.users, {
    uid: user.uid,
    name,
    email: user.email ?? "",
    phone: null,
    address: null,
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
  const profile: UserProfile = {
    uid: user.uid,
    name,
    email: user.email ?? "",
    phone: null,
    address: null,
    role: "consumer",
    status: "active",
    hospitalId: null,
    createdAt: null,
    updatedAt: null,
  };
  profileCache.set(user.uid, profile);
  return profile;
}

export async function updateUserProfile(
  uid: string,
  changes: { name?: string; phone?: string | null; address?: string | null },
) {
  const allowedChanges: Record<string, unknown> = {
    updatedAt: firestoreTimestamp.server(),
    updatedBy: uid,
  };
  if (typeof changes.name === "string") allowedChanges.name = changes.name.trim();
  if (changes.phone !== undefined) allowedChanges.phone = changes.phone?.trim() || null;
  if (changes.address !== undefined) allowedChanges.address = changes.address?.trim() || null;
  const role = profileCache.get(uid)?.role ?? "consumer";
  await updateAuditedDocument(
    COLLECTIONS.users,
    uid,
    allowedChanges,
    { action: "update", actorRole: role },
    profileCache.get(uid),
  );
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

export function listUsers(role: "consumer" | "hospital", options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<UserDocument>({
    collectionPath: COLLECTIONS.users,
    filters: [{ field: "role", operator: "==", value: role }],
    sort: { field: "createdAt", direction: "desc" },
    ...options,
  });
}

export const archiveUser = (uid: string) => updateAuditedDocument(COLLECTIONS.users, uid, {
  status: "archived", ...getArchiveMetadata(),
}, { action: "archive", actorRole: "admin" });

export const restoreUser = (uid: string) => updateAuditedDocument(COLLECTIONS.users, uid, {
  status: "inactive", ...getRestoreMetadata(),
}, { action: "restore", actorRole: "admin" });
