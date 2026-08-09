"use client";

import type { ServiceDocument } from "@/features/firestore/models";
import type { DocumentData } from "firebase/firestore";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, readDocument, runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { createAuditedDocument, getArchiveMetadata, getAuditActorId, getRestoreMetadata, updateAuditedDocument } from "@/services/firestore/auditService";

type ServiceInput = Pick<ServiceDocument,
  "hospitalId" | "name" | "description" | "price" | "durationMinutes" | "status"
>;

export const getService = (id: string) => readDocument<ServiceDocument>(COLLECTIONS.services, id);

export function listHospitalServices(hospitalId: string, options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [{ field: "hospitalId", operator: "==", value: hospitalId }],
    sort: { field: "name", direction: "asc" }, ...options,
  });
}

export function listActiveHospitalServices(hospitalId: string, options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [
      { field: "hospitalId", operator: "==", value: hospitalId },
      { field: "status", operator: "==", value: "active" },
    ],
    sort: { field: "name", direction: "asc" }, ...options,
  });
}

export const createService = (input: ServiceInput) => {
  const actorId = getAuditActorId();
  return createAuditedDocument(COLLECTIONS.services, {
    ...input, createdAt: firestoreTimestamp.server(), createdBy: actorId,
    updatedAt: firestoreTimestamp.server(), updatedBy: actorId,
    archivedAt: null, archivedBy: null,
  }, { action: "create", actorRole: "hospital" });
};

export const updateService = (id: string, input: Partial<Omit<ServiceInput, "hospitalId">>, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.services, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
  }, { action: input.status ? "status_change" : "update", actorRole: "hospital" }, previousValues);

export const archiveService = (id: string) => updateAuditedDocument(COLLECTIONS.services, id, {
  status: "archived", ...getArchiveMetadata(),
}, { action: "archive", actorRole: "hospital" });

export const restoreService = (id: string) => updateAuditedDocument(COLLECTIONS.services, id, {
  status: "inactive", ...getRestoreMetadata(),
}, { action: "restore", actorRole: "hospital" });
