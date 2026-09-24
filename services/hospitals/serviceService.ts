"use client";

import type { ServiceDocument } from "@/features/firestore/models";
import type { DocumentData } from "firebase/firestore";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, readDocument, runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { createAuditedDocument, getArchiveMetadata, getAuditActorId, replaceAuditedDocument, updateAuditedDocument } from "@/services/firestore/auditService";

export { listPublicHospitalServices as listActiveHospitalServices } from "@/services/hospitals/publicHospitalService";

type ServiceInput = Pick<ServiceDocument,
  "hospitalId" | "name" | "description" | "packageDurationDays" | "procedures" |
  "otherProcedures" | "otherProcedureName" | "otherProcedureDays" | "status"
>;

export const getService = (id: string) => readDocument<ServiceDocument>(COLLECTIONS.services, id);

export function listHospitalServices(
  hospitalId: string,
  options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {},
  searchTerm = "",
) {
  const trimmedSearch = searchTerm.trim();
  const namePrefix = trimmedSearch
    ? `${trimmedSearch.charAt(0).toUpperCase()}${trimmedSearch.slice(1)}`
    : "";
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [{ field: "hospitalId", operator: "==", value: hospitalId }],
    sort: { field: "name", direction: "asc" },
    startAtValues: namePrefix ? [namePrefix] : undefined,
    endAtValues: namePrefix ? [`${namePrefix}\uf8ff`] : undefined,
    ...options,
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

export function updateService(id: string, input: Partial<Omit<ServiceInput, "hospitalId">>, previousValues?: DocumentData) {
  const actorId = getAuditActorId();
  if (input.packageDurationDays !== undefined && previousValues) {
    return replaceAuditedDocument(COLLECTIONS.services, id, {
      hospitalId: previousValues.hospitalId,
      name: input.name,
      description: input.description ?? "",
      packageDurationDays: input.packageDurationDays,
      procedures: input.procedures ?? {},
      otherProcedures: input.otherProcedures ?? [],
      otherProcedureName: input.otherProcedureName ?? null,
      otherProcedureDays: input.otherProcedureDays ?? null,
      status: input.status ?? previousValues.status,
      createdAt: previousValues.createdAt,
      createdBy: previousValues.createdBy,
      updatedAt: firestoreTimestamp.server(),
      updatedBy: actorId,
      archivedAt: previousValues.archivedAt ?? null,
      archivedBy: previousValues.archivedBy ?? null,
    }, { action: "update", actorRole: "hospital" }, previousValues);
  }
  return updateAuditedDocument(COLLECTIONS.services, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: actorId,
  }, { action: input.status ? "status_change" : "update", actorRole: "hospital" }, previousValues);
}

export const archiveService = (id: string, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.services, id, {
    status: "archived",
    ...getArchiveMetadata(),
  }, { action: "archive", actorRole: "hospital" }, previousValues);
