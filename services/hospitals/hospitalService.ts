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
import { getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
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

function adminHospitalAction(id: string, action: "update" | "contract_generated" | "contract_signed" | "deactivate" | "archive", data?: Record<string, unknown>) {
  return authorizedApiRequest<{ ok: true }>(`/api/admin/hospitals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
    signedOutMessage: "Your Admin session has expired. Sign in again to update the hospital.",
    failureMessage: "We could not update the hospital. Please try again.",
  });
}

export const updateHospital = (id: string, input: HospitalAdminUpdate) =>
  adminHospitalAction(id, "update", input);

export const recordHospitalContractGeneration = (id: string) =>
  adminHospitalAction(id, "contract_generated");

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
  return adminHospitalAction(id, "contract_signed", { contractUrl, contractUrl2 });
}

export function activateHospital(id: string, previous: DocumentData) {
  if (previous.contractStatus !== "signed" || !previous.contractSignedAt || !previous.contractSignedAt2 || !previous.contractUrl || !previous.contractUrl2) {
    throw new Error("Confirm both signed contracts before activating the hospital.");
  }
  return authorizedApiRequest<{ ok: true }>(`/api/admin/hospitals/${encodeURIComponent(id)}/activate`, {
    method: "POST",
    signedOutMessage: "Your Admin session has expired. Sign in again to activate the hospital.",
    failureMessage: "We could not activate the hospital. Please try again.",
  });
}

export const deactivateHospital = (id: string) => adminHospitalAction(id, "deactivate");

export const updateHospitalProfile = (id: string, input: Partial<HospitalProfileInput>, previousValues?: DocumentData) =>
  updateAuditedDocument(COLLECTIONS.hospitals, id, {
    ...input, updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
  }, { action: "update", actorRole: "hospital" }, previousValues);

export const archiveHospital = (id: string) => adminHospitalAction(id, "archive");
