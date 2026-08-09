"use client";

import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentData } from "firebase/firestore";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, readDocument, runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { createAuditedDocument, getArchiveMetadata, getAuditActorId, getRestoreMetadata, updateAuditedDocument } from "@/services/firestore/auditService";

type HospitalInput = Pick<HospitalDocument,
  "name" | "description" | "email" | "phone" | "address" | "city" | "state" |
  "imageUrl" | "status" | "isPublic" | "commissionPercentage"
>;
type HospitalProfileInput = Pick<HospitalDocument,
  "name" | "description" | "email" | "phone" | "address" | "city" | "state" | "imageUrl"
>;

export const getHospital = (id: string) => readDocument<HospitalDocument>(COLLECTIONS.hospitals, id);

export function listPublicHospitals(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<HospitalDocument>({
    collectionPath: COLLECTIONS.hospitals,
    filters: [
      { field: "isPublic", operator: "==", value: true },
      { field: "status", operator: "==", value: "active" },
    ],
    sort: { field: "name", direction: "asc" }, ...options,
  });
}

export function listAllHospitals(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<HospitalDocument>({
    collectionPath: COLLECTIONS.hospitals,
    sort: { field: "createdAt", direction: "desc" }, ...options,
  });
}

export function createHospital(input: HospitalInput, createdBy: string) {
  return createAuditedDocument(COLLECTIONS.hospitals, {
    ...input, imageUrl: input.imageUrl || null, createdBy,
    createdAt: firestoreTimestamp.server(), updatedAt: firestoreTimestamp.server(), updatedBy: createdBy,
    archivedAt: null, archivedBy: null,
  }, { action: "create", actorRole: "admin" });
}

export const updateHospital = (id: string, input: Partial<HospitalInput>, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.hospitals, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
  }, { action: input.status ? "status_change" : "update", actorRole: "admin" }, previousValues);

export const updateHospitalProfile = (id: string, input: Partial<HospitalProfileInput>, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.hospitals, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
  }, { action: "update", actorRole: "hospital" }, previousValues);

export const archiveHospital = (id: string) => updateAuditedDocument(COLLECTIONS.hospitals, id, {
  status: "archived", isPublic: false, ...getArchiveMetadata(),
}, { action: "archive", actorRole: "admin" });

export const restoreHospital = (id: string) => updateAuditedDocument(COLLECTIONS.hospitals, id, {
  status: "inactive", isPublic: false, ...getRestoreMetadata(),
}, { action: "restore", actorRole: "admin" });
