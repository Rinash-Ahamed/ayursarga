"use client";

import type { HospitalCapacityDocument } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import { firestoreTimestamp, readDocument } from "@/services/firestore/firestoreService";
import { createAuditedDocument, getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
import type { PortalRole } from "@/features/auth/contracts";
import { authorizedMutationRequest } from "@/services/api/client";

type HospitalCapacityInput = {
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

export async function saveHospitalCapacity(
  hospitalId: string,
  input: HospitalCapacityInput,
  previous?: Pick<HospitalCapacityDocument, "totalRooms" | "occupiedRooms"> | null,
  actorRole: Extract<PortalRole, "admin" | "hospital"> = "hospital",
) {
  validateCapacity(input);
  if (actorRole === "hospital") {
    return authorizedMutationRequest<HospitalCapacityDocument>("/api/hospital/capacity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signedOutMessage: "Your Hospital session has expired. Sign in again to update room availability.",
      failureMessage: "We could not update room availability. Please try again.",
    });
  }
  const actorId = getAuditActorId();
  if (!previous) {
    await createAuditedDocument(COLLECTIONS.hospitalCapacity, {
      hospitalId,
      ...input,
      status: "active",
      createdAt: firestoreTimestamp.server(),
      createdBy: actorId,
      updatedAt: firestoreTimestamp.server(),
      updatedBy: actorId,
      archivedAt: null,
      archivedBy: null,
    }, { action: "create", actorRole }, hospitalId);
    return input;
  }
  await updateAuditedDocument(COLLECTIONS.hospitalCapacity, hospitalId, {
    ...input,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: actorId,
  }, { action: "update", actorRole }, previous);
  return input;
}
