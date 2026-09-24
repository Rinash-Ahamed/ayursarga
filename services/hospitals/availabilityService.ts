"use client";

import { Timestamp } from "firebase/firestore";
import type { AvailabilityDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { firestoreTimestamp, runFilteredQuery } from "@/services/firestore/firestoreService";
import { createAuditedDocument, getAuditActorId } from "@/services/firestore/auditService";
import { authorizedApiRequest } from "@/services/api/client";
import { COLLECTIONS } from "@/constants/firestore";
import { validateAvailabilityRange } from "@/features/hospitals/availability";

export function requestAvailabilityBlock(input: {
  hospitalId: string;
  hospitalName: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const range = validateAvailabilityRange(input.startDate, input.endDate);
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("Enter a short reason between 3 and 500 characters.");
  const actorId = getAuditActorId();
  return createAuditedDocument(COLLECTIONS.availability, {
    hospitalId: input.hospitalId,
    hospitalName: input.hospitalName.trim(),
    startDate: Timestamp.fromDate(range.startDate),
    endDate: Timestamp.fromDate(range.endDate),
    reason,
    source: "hospital_portal",
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    createdAt: firestoreTimestamp.server(),
    createdBy: actorId,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
    archivedAt: null,
    archivedBy: null,
  }, { action: "create", actorRole: "hospital" });
}

export function listHospitalAvailabilityRequests(hospitalId: string, options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<AvailabilityDocument>({
    collectionPath: COLLECTIONS.availability,
    filters: [{ field: "hospitalId", operator: "==", value: hospitalId }],
    sort: { field: "createdAt", direction: "desc" },
    ...options,
  });
}

export function listAdminAvailabilityRequests(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<AvailabilityDocument>({
    collectionPath: COLLECTIONS.availability,
    sort: { field: "createdAt", direction: "desc" },
    ...options,
  });
}

export function createAdminAvailabilityBlock(input: { hospitalId: string; startDate: string; endDate: string; reason: string }) {
  const range = validateAvailabilityRange(input.startDate, input.endDate);
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("Enter a short reason between 3 and 500 characters.");
  return authorizedApiRequest<{ ok: true }>("/api/admin/availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospitalId: input.hospitalId,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      reason,
    }),
    signedOutMessage: "Your Admin session has expired. Sign in again to block availability.",
    failureMessage: "We could not block these dates. Try again.",
  });
}

export function reviewAvailabilityRequest(record: DocumentRecord<AvailabilityDocument>, action: "approve" | "reject" | "cancel") {
  return authorizedApiRequest<{ ok: true }>(`/api/admin/availability/${encodeURIComponent(record.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
    signedOutMessage: "Your Admin session has expired. Sign in again to update availability.",
    failureMessage: "We could not update this availability request. Try again.",
  });
}
