"use client";

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import type { PortalRole } from "@/features/auth/contracts";
import type { AuditAction, AuditLogDocument } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import { getClientAuth } from "@/services/auth/client";
import { getClientFirestore } from "@/services/firestore/client";
import { runFilteredQuery, type QueryFilter, type QueryPageOptions } from "@/services/firestore/firestoreService";

type AuditContext = {
  action: AuditAction;
  actorRole: PortalRole;
};

export function getAuditActorId() {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("An authenticated user is required for this operation.");
  return uid;
}

export function getArchiveMetadata() {
  const actorId = getAuditActorId();
  return {
    archivedAt: serverTimestamp(),
    archivedBy: actorId,
    updatedAt: serverTimestamp(),
    updatedBy: actorId,
  };
}

export function getRestoreMetadata() {
  return {
    archivedAt: null,
    archivedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: getAuditActorId(),
  };
}

function getDeviceMetadata() {
  if (typeof navigator === "undefined") {
    return { userAgent: null, platform: null, ipAddress: null };
  }
  return {
    userAgent: navigator.userAgent.slice(0, 500),
    platform: navigator.platform?.slice(0, 120) || null,
    ipAddress: null,
  };
}

function auditEntry(
  module: string,
  recordId: string,
  context: AuditContext,
  previousValues: DocumentData | null,
  updatedValues: DocumentData,
) {
  return {
    action: context.action,
    module,
    recordId,
    actorId: getAuditActorId(),
    actorRole: context.actorRole,
    previousValues,
    updatedValues,
    timestamp: serverTimestamp(),
    source: "web",
    device: getDeviceMetadata(),
  };
}

export async function createAuditedDocument(
  collectionPath: string,
  data: DocumentData,
  context: AuditContext,
  id?: string,
) {
  const firestore = getClientFirestore();
  const target = id ? doc(firestore, collectionPath, id) : doc(collection(firestore, collectionPath));
  const audit = doc(collection(firestore, COLLECTIONS.auditLogs));
  const documentData = { ...data, lastAuditId: audit.id };
  const batch = writeBatch(firestore);
  batch.set(target, documentData);
  batch.set(audit, auditEntry(collectionPath, target.id, context, null, documentData));
  await batch.commit();
  return target.id;
}

export async function updateAuditedDocument(
  collectionPath: string,
  id: string,
  changes: DocumentData,
  context: AuditContext,
  previousValues?: DocumentData,
) {
  const firestore = getClientFirestore();
  const target = doc(firestore, collectionPath, id);
  let previous = previousValues;
  if (!previous) {
    const current = await getDoc(target);
    if (!current.exists()) throw new Error("The requested record could not be found.");
    previous = current.data();
  } else if ("id" in previous) {
    previous = { ...previous };
    delete previous.id;
  }

  const audit = doc(collection(firestore, COLLECTIONS.auditLogs));
  const updatedValues = { ...changes, lastAuditId: audit.id };
  const batch = writeBatch(firestore);
  batch.update(target, updatedValues);
  batch.set(audit, auditEntry(collectionPath, id, context, previous, updatedValues));
  await batch.commit();
}

type AuditLogScope =
  | { actorId: string; module?: never; recordId?: never }
  | { actorId?: never; module: string; recordId: string }
  | { actorId?: never; module?: never; recordId?: never };

type AuditLogQuery = Pick<QueryPageOptions, "pageSize" | "cursor"> & AuditLogScope;

export function listAuditLogs(options: AuditLogQuery = {}) {
  const filters: QueryFilter[] = [];
  if (options.actorId) {
    filters.push({ field: "actorId", operator: "==", value: options.actorId });
  } else if (options.module && options.recordId) {
    filters.push(
      { field: "module", operator: "==", value: options.module },
      { field: "recordId", operator: "==", value: options.recordId },
    );
  }
  return runFilteredQuery<AuditLogDocument>({
    collectionPath: COLLECTIONS.auditLogs,
    filters,
    sort: { field: "timestamp", direction: "desc" },
    pageSize: options.pageSize,
    cursor: options.cursor,
    excludeArchived: false,
  });
}
