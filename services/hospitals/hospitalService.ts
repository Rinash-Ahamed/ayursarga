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
import { DEFAULT_CENTRE_GUIDELINE_VALUES } from "@/features/hospitals/guidelines";

export { listPublicHospitals } from "@/services/hospitals/publicHospitalService";

type HospitalAdminUpdate = Partial<HospitalFields & Pick<HospitalDocument,
  "status" | "isPublic" | "ayursargaRating" | "ayursargaReviewNote" | "imageUrls" | "locationUrl"
>>;
type HospitalProfileInput = Pick<HospitalDocument,
  "name" | "description" | "email" | "phone" | "hospitalPhone1" | "hospitalPhone2" | "address" | "city" | "district" | "state" |
  "centreGuidelines" | "additionalCentreRules" | "facilities" | "legalPolicies"
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

export function createHospital(input: HospitalFields) {
  const validation = validateHospitalFields(input);
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] ?? "Hospital details are invalid.");
  // Use the same live Firebase identity for the hospital metadata and its
  // linked audit entry. A cached React auth value can briefly lag behind
  // Firebase Auth after an account switch, which correctly causes the atomic
  // write to be rejected by Firestore rules.
  const actorId = getAuditActorId();
  return createAuditedDocument(COLLECTIONS.hospitals, {
    ...validation.data,
    status: "pending",
    isPublic: false,
    contractStatus: "not_generated",
    contractGeneratedAt: null,
    contractGeneratedBy: null,
    contractSignedAt: null,
    contractSignedBy: null,
    contractUrl: null,
    contractSignedAt2: null,
    contractSignedBy2: null,
    contractUrl2: null,
    imageUrls: [],
    ayursargaRating: null,
    ayursargaReviewNote: null,
    centreGuidelines: DEFAULT_CENTRE_GUIDELINE_VALUES,
    additionalCentreRules: "",
    facilities: "",
    legalPolicies: "",
    locationUrl: null,
    activatedAt: null,
    activatedBy: null,
    createdBy: actorId,
    createdAt: firestoreTimestamp.server(), updatedAt: firestoreTimestamp.server(), updatedBy: actorId,
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
    contractSignedAt2: previous.contractSignedAt2 ?? null,
    contractSignedBy2: previous.contractSignedBy2 ?? null,
    contractUrl2: previous.contractUrl2 ?? null,
    activatedAt: previous.activatedAt ?? null,
    activatedBy: previous.activatedBy ?? null,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "contract_generated", actorRole: "admin" }, previous);
}

function validatedContractUrl(value: string, label: string) {
  const contractUrl = value.trim();
  if (contractUrl.length > 500) throw new Error(`${label} must be 500 characters or fewer.`);
  try {
    const parsed = new URL(contractUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`Enter a valid ${label.toLowerCase()} beginning with http:// or https://.`);
  }
  return contractUrl;
}

export function confirmHospitalContractSigning(id: string, previous: DocumentData, contractUrlInput: string, contractUrl2Input: string) {
  if (!(["generated", "signed"] as string[]).includes(previous.contractStatus)) {
    throw new Error("Select Generate Contract PDF before confirming that the contract has been signed.");
  }
  const contractUrl = validatedContractUrl(contractUrlInput, "Contract 1 URL");
  const contractUrl2 = validatedContractUrl(contractUrl2Input, "Contract 2 URL");
  const actorId = getAuditActorId();
  return updateAuditedDocument(COLLECTIONS.hospitals, id, {
    contractStatus: "signed",
    contractSignedAt: previous.contractSignedAt ?? firestoreTimestamp.server(),
    contractSignedBy: previous.contractSignedBy ?? actorId,
    contractUrl,
    contractSignedAt2: previous.contractSignedAt2 ?? firestoreTimestamp.server(),
    contractSignedBy2: previous.contractSignedBy2 ?? actorId,
    contractUrl2,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "contract_signed", actorRole: "admin" }, previous);
}

export function activateHospital(id: string, previous: DocumentData) {
  if (previous.contractStatus !== "signed" || !previous.contractSignedAt || !previous.contractSignedAt2 || !previous.contractUrl || !previous.contractUrl2) {
    throw new Error("Confirm both signed contracts before activating the hospital.");
  }
  const actorId = getAuditActorId();
  return updateAuditedDocument(COLLECTIONS.hospitals, id, {
    status: "active",
    isPublic: true,
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
