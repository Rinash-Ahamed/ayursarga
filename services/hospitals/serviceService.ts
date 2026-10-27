"use client";

import type { ServiceDocument } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import { runFilteredQuery, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { authorizedApiRequest, authorizedMutationRequest } from "@/services/api/client";

type ServiceInput = Pick<ServiceDocument,
  "hospitalId" | "name" | "description" | "price" | "packageDurationDays" | "procedures" |
  "otherProcedures" | "otherProcedureName" | "otherProcedureDays" | "status"
>;

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

export const createService = (input: ServiceInput, requestId?: string) => {
  const { hospitalId: _hospitalId, ...packageInput } = input;
  void _hospitalId;
  return authorizedApiRequest<{ ok: true; serviceId: string; duplicate?: boolean }>("/api/hospital/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...packageInput, requestId }),
    signedOutMessage: "Your Hospital session has expired. Sign in again to add a package.",
    failureMessage: "We could not add the package. Please try again.",
  });
};

export function updateService(id: string, input: Partial<Omit<ServiceInput, "hospitalId">>, expectedAuditId?: string) {
  const statusOnly = input.status !== undefined && input.packageDurationDays === undefined;
  return authorizedMutationRequest<ServiceDocument>(`/api/hospital/services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: statusOnly ? "status" : "update", data: input, expectedAuditId }),
    signedOutMessage: "Your Hospital session has expired. Sign in again to update the package.",
    failureMessage: "We could not update the package. Please try again.",
  });
}

export function submitService(id: string, expectedAuditId: string) {
  return authorizedMutationRequest<ServiceDocument>(`/api/hospital/services/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "submit", expectedAuditId }),
    signedOutMessage: "Sign in again to submit this package.", failureMessage: "We could not submit this package for review.",
  });
}

export function reviewHospitalPackages(hospitalId: string, packages: { id: string; auditId: string }[], action: "approve" | "request_changes", reason = "") {
  return authorizedMutationRequest<{ packages: Record<string, Partial<ServiceDocument>> }>(`/api/admin/hospitals/${encodeURIComponent(hospitalId)}/packages`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packages, action, reason }),
    signedOutMessage: "Sign in again to review these packages.", failureMessage: "We could not save this package review.",
  });
}

export const archiveService = (id: string) =>
  authorizedApiRequest<{ ok: true }>(`/api/hospital/services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "archive" }),
    signedOutMessage: "Your Hospital session has expired. Sign in again to archive the package.",
    failureMessage: "We could not archive the package. Please try again.",
  });
