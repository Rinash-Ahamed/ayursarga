"use client";

import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentData } from "firebase/firestore";
import type { HospitalFields } from "@/features/hospitals/validation";
import { validateHospitalFields } from "@/features/hospitals/validation";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, readDocument, runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { createAuditedDocument, getArchiveMetadata, getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";

export { listPublicHospitals } from "@/services/hospitals/publicHospitalService";

type HospitalAdminUpdate = Partial<HospitalFields & Pick<HospitalDocument, "status" | "isPublic">>;
type HospitalProfileInput = Pick<HospitalDocument,
  "name" | "description" | "email" | "phone" | "address" | "city" | "state"
>;

export const getHospital = (id: string) => readDocument<HospitalDocument>(COLLECTIONS.hospitals, id);

export function listAllHospitals(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}, searchTerm = "") {
  const trimmedSearch = searchTerm.trim();
  const namePrefix = trimmedSearch
    ? `${trimmedSearch.charAt(0).toUpperCase()}${trimmedSearch.slice(1)}`
    : "";
  return runFilteredQuery<HospitalDocument>({
    collectionPath: COLLECTIONS.hospitals,
    sort: namePrefix
      ? { field: "name", direction: "asc" }
      : { field: "createdAt", direction: "desc" },
    startAtValues: namePrefix ? [namePrefix] : undefined,
    endAtValues: namePrefix ? [`${namePrefix}\uf8ff`] : undefined,
    ...options,
  });
}

export function createHospital(input: HospitalFields, createdBy: string) {
  const validation = validateHospitalFields(input);
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] ?? "Hospital details are invalid.");
  return createAuditedDocument(COLLECTIONS.hospitals, {
    ...validation.data,
    status: "pending",
    isPublic: false,
    ratingAverage: 0,
    ratingCount: 0,
    contractStatus: "not_generated",
    contractGeneratedAt: null,
    contractGeneratedBy: null,
    contractSignedAt: null,
    contractSignedBy: null,
    contractUrl: null,
    activatedAt: null,
    activatedBy: null,
    createdBy,
    createdAt: firestoreTimestamp.server(), updatedAt: firestoreTimestamp.server(), updatedBy: createdBy,
    archivedAt: null, archivedBy: null,
  }, { action: "create", actorRole: "admin" });
}

export const updateHospital = (id: string, input: HospitalAdminUpdate, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.hospitals, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
  }, { action: input.status ? "status_change" : "update", actorRole: "admin" }, previousValues);

export function recordHospitalContractGeneration(id: string, previous: DocumentData) {
  const actorId = getAuditActorId();
  return updateAuditedDocument(COLLECTIONS.hospitals, id, {
    contractStatus: previous.contractStatus === "signed" ? "signed" : "generated",
    contractGeneratedAt: firestoreTimestamp.server(),
    contractGeneratedBy: actorId,
    contractSignedAt: previous.contractSignedAt ?? null,
    contractSignedBy: previous.contractSignedBy ?? null,
    contractUrl: previous.contractUrl ?? null,
    activatedAt: previous.activatedAt ?? null,
    activatedBy: previous.activatedBy ?? null,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "contract_generated", actorRole: "admin" }, previous);
}

export function confirmHospitalContractSigning(id: string, previous: DocumentData) {
  if (previous.contractStatus !== "generated") {
    throw new Error("Select Generate Contract PDF before confirming that the contract has been signed.");
  }
  const actorId = getAuditActorId();
  return updateAuditedDocument(COLLECTIONS.hospitals, id, {
    contractStatus: "signed",
    contractSignedAt: firestoreTimestamp.server(),
    contractSignedBy: actorId,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "contract_signed", actorRole: "admin" }, previous);
}

export function activateHospital(id: string, previous: DocumentData, contractUrlInput: string) {
  if (previous.contractStatus !== "signed" || !previous.contractSignedAt) {
    throw new Error("Confirm that the hospital has signed the contract before activating it.");
  }
  const contractUrl = contractUrlInput.trim();
  if (contractUrl.length > 500) throw new Error("The signed contract URL must be 500 characters or fewer.");
  try {
    const parsed = new URL(contractUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("Enter a valid signed contract URL beginning with http:// or https://.");
  }
  const actorId = getAuditActorId();
  return updateAuditedDocument(COLLECTIONS.hospitals, id, {
    status: "active",
    isPublic: true,
    contractUrl,
    activatedAt: firestoreTimestamp.server(),
    activatedBy: actorId,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "hospital_activated", actorRole: "admin" }, previous);
}

export function deactivateHospital(id: string, previous: DocumentData) {
  return updateHospital(id, { status: "inactive", isPublic: false }, previous);
}

export const updateHospitalProfile = (id: string, input: Partial<HospitalProfileInput>, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.hospitals, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
  }, { action: "update", actorRole: "hospital" }, previousValues);

export const archiveHospital = (id: string, previousValues?: DocumentData) => updateAuditedDocument(COLLECTIONS.hospitals, id, {
  status: "archived", isPublic: false, ...getArchiveMetadata(),
}, { action: "archive", actorRole: "admin" }, previousValues);
