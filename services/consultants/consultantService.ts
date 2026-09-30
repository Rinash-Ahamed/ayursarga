"use client";

import type { DocumentData } from "firebase/firestore";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { ConsultantFields } from "@/features/consultants/validation";
import { validateConsultantFields } from "@/features/consultants/validation";
import { COLLECTIONS } from "@/constants/firestore";
import { firestoreTimestamp, runFilteredQuery, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
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

export function updateConsultant(id: string, input: ConsultantFields, previous: DocumentData) {
  const validation = validateConsultantFields(input);
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] ?? "Consultant details are invalid.");
  return updateAuditedDocument(COLLECTIONS.consultants, id, {
    ...validation.data,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: getAuditActorId(),
  }, { action: "update", actorRole: "admin" }, previous);
}

export function setConsultantStatus(id: string, status: "active" | "inactive", previous: DocumentData) {
  return updateAuditedDocument(COLLECTIONS.consultants, id, {
    status,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: getAuditActorId(),
  }, { action: "status_change", actorRole: "admin" }, previous);
}
