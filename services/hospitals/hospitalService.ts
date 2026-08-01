"use client";

import type { HospitalDocument } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import {
  createDocument, firestoreTimestamp, readDocument, runFilteredQuery, updateDocument,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";

export type HospitalInput = Pick<HospitalDocument,
  "name" | "description" | "email" | "phone" | "address" | "city" | "state" |
  "imageUrl" | "status" | "isPublic" | "commissionPercentage"
>;
export type HospitalProfileInput = Pick<HospitalDocument,
  "name" | "description" | "email" | "phone" | "address" | "city" | "state" | "imageUrl"
>;

export const getHospital = (id: string) => readDocument<HospitalDocument>(COLLECTIONS.hospitals, id);

export function listPublicHospitals(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<HospitalDocument>({
    collectionPath: COLLECTIONS.hospitals,
    filters: [
      { field: "isPublic", operator: "==", value: true },
      { field: "status", operator: "==", value: "active" },
    ],
    sort: { field: "name", direction: "asc" }, ...options,
  });
}

export function listAllHospitals(options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<HospitalDocument>({
    collectionPath: COLLECTIONS.hospitals,
    sort: { field: "createdAt", direction: "desc" }, ...options,
  });
}

export function createHospital(input: HospitalInput, createdBy: string) {
  return createDocument(COLLECTIONS.hospitals, {
    ...input, imageUrl: input.imageUrl || null, createdBy,
    createdAt: firestoreTimestamp.server(), updatedAt: firestoreTimestamp.server(),
  });
}

export const updateHospital = (id: string, input: Partial<HospitalInput>) =>
  updateDocument(COLLECTIONS.hospitals, id, { ...input, updatedAt: firestoreTimestamp.server() });

export const updateHospitalProfile = (id: string, input: Partial<HospitalProfileInput>) =>
  updateDocument(COLLECTIONS.hospitals, id, { ...input, updatedAt: firestoreTimestamp.server() });
