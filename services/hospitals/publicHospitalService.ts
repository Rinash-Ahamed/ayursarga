"use client";

import { COLLECTIONS } from "@/constants/firestore";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import {
  readDocumentsByIds,
  runFilteredQuery,
  type QueryPage,
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

function listActiveServicesByName(serviceName: string, options: PublicPageOptions = {}) {
  return runFilteredQuery<ServiceDocument>({
    collectionPath: COLLECTIONS.services,
    filters: [
      { field: "name", operator: "==", value: serviceName },
      { field: "status", operator: "==", value: "active" },
    ],
    ...options,
  });
}

export async function listPublicHospitalsByServiceName(
  serviceName: string,
  options: PublicPageOptions = {},
): Promise<QueryPage<HospitalDocument>> {
  const servicePage = await listActiveServicesByName(serviceName, options);
  const hospitalIds = [...new Set(servicePage.documents.map((service) => service.hospitalId).filter(Boolean))];
  const hospitals = await readDocumentsByIds<HospitalDocument>(COLLECTIONS.hospitals, hospitalIds, [
    { field: "isPublic", operator: "==", value: true },
    { field: "status", operator: "==", value: "active" },
  ]);
  const documents = hospitals.filter((hospital) => hospital.isPublic && hospital.status === "active");

  return {
    documents,
    cursor: servicePage.cursor,
    hasMore: servicePage.hasMore,
  };
}
