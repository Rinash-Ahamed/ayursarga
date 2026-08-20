"use client";

import { COLLECTIONS } from "@/constants/firestore";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import {
  runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";

type PublicPageOptions = Pick<QueryPageOptions, "pageSize" | "cursor">;

export function listPublicHospitals(options: PublicPageOptions = {}) {
  return runFilteredQuery<HospitalDocument>({
    collectionPath: COLLECTIONS.hospitals,
    filters: [
      { field: "isPublic", operator: "==", value: true },
      { field: "status", operator: "==", value: "active" },
    ],
    sort: { field: "name", direction: "asc" },
    ...options,
  });
}

export function listPublicHospitalServices(hospitalId: string, options: PublicPageOptions = {}) {
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [
      { field: "hospitalId", operator: "==", value: hospitalId },
      { field: "status", operator: "==", value: "active" },
    ],
    sort: { field: "name", direction: "asc" },
    ...options,
  });
}
