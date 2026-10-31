"use client";

import type { DocumentData } from "firebase/firestore";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { ConsultantFields } from "@/features/consultants/validation";
import { validateConsultantFields } from "@/features/consultants/validation";
import { COLLECTIONS } from "@/constants/firestore";
import { runFilteredQuery, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { authorizedApiRequest } from "@/services/api/client";

export function listConsultants(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}, searchTerm = "") {
  const trimmedSearch = searchTerm.trim();
  const searchingByEmployeeId = /^as\d*/i.test(trimmedSearch);
  const prefix = searchingByEmployeeId
    ? trimmedSearch.toUpperCase()
    : trimmedSearch ? `${trimmedSearch.charAt(0).toUpperCase()}${trimmedSearch.slice(1)}` : "";
  const sortField = prefix ? (searchingByEmployeeId ? "employeeId" : "name") : "employeeSequence";
  return runFilteredQuery<ConsultantDocument>({
    collectionPath: COLLECTIONS.consultants,
    sort: { field: sortField, direction: prefix ? "asc" : "desc" },
    startAtValues: prefix ? [prefix] : undefined,
    endAtValues: prefix ? [`${prefix}\uf8ff`] : undefined,
    excludeArchived: false,
    ...options,
  });
}

export async function createConsultant(input: ConsultantFields) {
  const validation = validateConsultantFields(input);
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] ?? "Consultant details are invalid.");
  const response = await authorizedApiRequest<{ ok: true; employeeId: string }>("/api/admin/consultants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validation.data),
    signedOutMessage: "Sign in as Admin before adding a consultant.",
    failureMessage: "We could not add the consultant.",
  });
  return response.employeeId;
}

export function updateConsultant(id: string, input: ConsultantFields, _previous: DocumentData) {
  void _previous;
  const validation = validateConsultantFields(input);
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] ?? "Consultant details are invalid.");
  return saveConsultant(id, { action: "update", fields: validation.data });
}

export function setConsultantStatus(id: string, status: "active" | "inactive", _previous: DocumentData) {
  void _previous;
  return saveConsultant(id, { action: "status_change", status });
}

function saveConsultant(id: string, body: Record<string, unknown>) {
  return authorizedApiRequest<{ ok: true }>(`/api/admin/consultants/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signedOutMessage: "Sign in as Admin before updating a consultant.",
    failureMessage: "We could not save the consultant. Refresh and try again.",
  });
}
