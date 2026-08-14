"use client";

import type { HospitalCapacityDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { COLLECTIONS } from "@/constants/firestore";
import { firestoreTimestamp, readDocument } from "@/services/firestore/firestoreService";
import { createAuditedDocument, getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";

export type HospitalCapacityInput = {
  totalRooms: number;
  occupiedRooms: number;
};

function validateCapacity(input: HospitalCapacityInput) {
  if (!Number.isInteger(input.totalRooms) || input.totalRooms < 0 || input.totalRooms > 10000) {
    throw new Error("Enter a valid total number of treatment rooms.");
  }
  if (!Number.isInteger(input.occupiedRooms) || input.occupiedRooms < 0) {
    throw new Error("Enter a valid number of occupied treatment rooms.");
  }
  if (input.occupiedRooms > input.totalRooms) {
    throw new Error("Occupied rooms cannot be greater than total treatment rooms.");
  }
}

export const getHospitalCapacity = (hospitalId: string) =>
  readDocument<HospitalCapacityDocument>(COLLECTIONS.hospitalCapacity, hospitalId);

export function saveHospitalCapacity(
  hospitalId: string,
  input: HospitalCapacityInput,
  previous?: DocumentRecord<HospitalCapacityDocument> | null,
) {
  validateCapacity(input);
  const actorId = getAuditActorId();
  if (!previous) {
    return createAuditedDocument(COLLECTIONS.hospitalCapacity, {
      hospitalId,
      ...input,
      status: "active",
      createdAt: firestoreTimestamp.server(),
      createdBy: actorId,
      updatedAt: firestoreTimestamp.server(),
      updatedBy: actorId,
      archivedAt: null,
      archivedBy: null,
    }, { action: "create", actorRole: "hospital" }, hospitalId);
  }
  return updateAuditedDocument(COLLECTIONS.hospitalCapacity, hospitalId, {
    ...input,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "update", actorRole: "hospital" }, previous);
}
