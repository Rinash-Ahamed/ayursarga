"use client";

import type { DocumentData } from "firebase/firestore";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { ConsultantFields } from "@/features/consultants/validation";
import { validateConsultantFields } from "@/features/consultants/validation";
import { COLLECTIONS } from "@/constants/firestore";
import { runStatusOrderedQuery, type StatusOrderedOptions } from "@/services/firestore/statusOrderedQuery";
import { authorizedApiRequest } from "@/services/api/client";
import { consultantPhotoFileError } from "@/features/consultants/photo";

export async function uploadConsultantPhoto(consultantId: string, file: File, expectedImageUrl?: string | null) {
  const error = consultantPhotoFileError(file);
  if (error) throw new Error(error);
  const result = await authorizedApiRequest<{ imageUrl: string }>(`/api/admin/consultants/${encodeURIComponent(consultantId)}/image`, {
    method: "POST", headers: { "Content-Type": file.type, "X-Expected-Image-Url": expectedImageUrl ?? "" }, body: file,
    signedOutMessage: "Sign in as Admin to upload a consultant photo.", failureMessage: "We could not save the consultant photo. Refresh to check the current photo before trying again.",
  });
  if (typeof result.imageUrl !== "string" || !result.imageUrl) throw new Error("Refresh to check whether the photo was saved before trying again.");
  return result.imageUrl;
}

export function listConsultants(options: StatusOrderedOptions = {}, searchTerm = "") {
  const trimmedSearch = searchTerm.trim();
  const searchingByEmployeeId = /^as\d*/i.test(trimmedSearch);
  const prefix = searchingByEmployeeId
    ? trimmedSearch.toUpperCase()
    : trimmedSearch ? `${trimmedSearch.charAt(0).toUpperCase()}${trimmedSearch.slice(1)}` : "";
  const sortField = prefix ? (searchingByEmployeeId ? "employeeId" : "name") : "employeeSequence";
  return runStatusOrderedQuery<ConsultantDocument>({
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
  return saveConsultant(id, { action: "update", fields: validation.data, expectedAuditId: previous.lastAuditId ?? "" });
}

export function setConsultantStatus(id: string, status: "active" | "inactive", previous: DocumentData) {
  return saveConsultant(id, { action: "status_change", status, expectedAuditId: previous.lastAuditId ?? "" });
}

function saveConsultant(id: string, body: Record<string, unknown>) {
  return authorizedApiRequest<{ ok: true; lastAuditId: string }>(`/api/admin/consultants/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signedOutMessage: "Sign in as Admin before updating a consultant.",
    failureMessage: "We could not save the consultant. Refresh and try again.",
  });
}
