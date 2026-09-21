"use client";

import type { DocumentData } from "firebase/firestore";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { ConsultantFields } from "@/features/consultants/validation";
import { validateConsultantFields } from "@/features/consultants/validation";
import { COLLECTIONS } from "@/constants/firestore";
import { firestoreTimestamp, runFilteredQuery, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { createAuditedDocument, getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";

export function listConsultants(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<ConsultantDocument>({
    collectionPath: COLLECTIONS.consultants,
    sort: { field: "employeeSequence", direction: "desc" },
    excludeArchived: false,
    ...options,
  });
}

async function nextEmployeeIdentity() {
  const latest = await runFilteredQuery<ConsultantDocument>({
    collectionPath: COLLECTIONS.consultants,
    sort: { field: "employeeSequence", direction: "desc" },
    pageSize: 1,
    excludeArchived: false,
  });
  const employeeSequence = (latest.documents[0]?.employeeSequence ?? 0) + 1;
  return { employeeSequence, employeeId: `AS${String(employeeSequence).padStart(3, "0")}` };
}

export async function createConsultant(input: ConsultantFields) {
  const validation = validateConsultantFields(input);
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] ?? "Consultant details are invalid.");
  const identity = await nextEmployeeIdentity();
  const actorId = getAuditActorId();
  await createAuditedDocument(COLLECTIONS.consultants, {
    ...identity,
    ...validation.data,
    status: "active",
    createdAt: firestoreTimestamp.server(),
    createdBy: actorId,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
    archivedAt: null,
    archivedBy: null,
  }, { action: "create", actorRole: "admin" }, identity.employeeId);
  return identity.employeeId;
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
