"use client";

import type { ServiceDocument } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import {
  createDocument, firestoreTimestamp, readDocument, runFilteredQuery, updateDocument,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";

export type ServiceInput = Pick<ServiceDocument,
  "hospitalId" | "name" | "description" | "price" | "durationMinutes" | "status"
>;

export const getService = (id: string) => readDocument<ServiceDocument>(COLLECTIONS.services, id);

export function listHospitalServices(hospitalId: string, options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [{ field: "hospitalId", operator: "==", value: hospitalId }],
    sort: { field: "name", direction: "asc" }, ...options,
  });
}

export function listActiveHospitalServices(hospitalId: string, options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [
      { field: "hospitalId", operator: "==", value: hospitalId },
      { field: "status", operator: "==", value: "active" },
    ],
    sort: { field: "name", direction: "asc" }, ...options,
  });
}

export const createService = (input: ServiceInput) => createDocument(COLLECTIONS.services, {
  ...input, createdAt: firestoreTimestamp.server(), updatedAt: firestoreTimestamp.server(),
});

export const updateService = (id: string, input: Partial<Omit<ServiceInput, "hospitalId">>) =>
  updateDocument(COLLECTIONS.services, id, { ...input, updatedAt: firestoreTimestamp.server() });
