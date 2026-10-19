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

export const createService = (input: ServiceInput) => {
  const { hospitalId: _hospitalId, ...packageInput } = input;
  void _hospitalId;
  return authorizedApiRequest<{ ok: true; serviceId: string }>("/api/hospital/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packageInput),
    signedOutMessage: "Your Hospital session has expired. Sign in again to add a package.",
    failureMessage: "We could not add the package. Please try again.",
  });
};

export function updateService(id: string, input: Partial<Omit<ServiceInput, "hospitalId">>) {
  const statusOnly = input.status !== undefined && input.packageDurationDays === undefined;
  return authorizedMutationRequest<ServiceDocument>(`/api/hospital/services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: statusOnly ? "status" : "update", data: input }),
    signedOutMessage: "Your Hospital session has expired. Sign in again to update the package.",
    failureMessage: "We could not update the package. Please try again.",
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
