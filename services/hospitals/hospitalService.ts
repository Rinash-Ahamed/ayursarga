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
import { getArchiveMetadata, getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
import { authorizedApiRequest } from "@/services/api/client";

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
  return authorizedApiRequest<{ ok: true; hospitalId: string }>("/api/admin/hospitals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validation.data),
    signedOutMessage: "Your Admin session has expired. Sign in again to create a hospital.",
    failureMessage: "We could not create the hospital. Please try again.",
  });
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
    throw new Error("Download the contract PDF before confirming that the contract has been signed.");
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
