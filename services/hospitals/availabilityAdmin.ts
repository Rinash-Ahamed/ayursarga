import "server-only";

import { FieldValue, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";

type StoredRange = { availabilityId: string; startDate: Timestamp; endDate: Timestamp };

function device(request: Request) {
  return {
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    platform: null,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  };
}

function activeRanges(value: unknown) {
  if (!Array.isArray(value)) return [] as StoredRange[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return value.filter((range): range is StoredRange => Boolean(
    range && typeof range === "object"
    && typeof (range as StoredRange).availabilityId === "string"
    && (range as StoredRange).startDate instanceof Timestamp
    && (range as StoredRange).endDate instanceof Timestamp
    && (range as StoredRange).endDate.toDate() >= today,
  ));
}

export async function createAdminBlock(input: {
  firestore: Firestore;
  adminUid: string;
  hospitalId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  request: Request;
}) {
  const hospitalReference = input.firestore.collection("hospitals").doc(input.hospitalId);
  const hospitalSnapshot = await hospitalReference.get();
  const hospital = hospitalSnapshot.data();
  if (!hospitalSnapshot.exists || !hospital || hospital.status === "archived") throw new Error("The selected hospital is unavailable.");

  const availabilityReference = input.firestore.collection("availability").doc();
  await writeBlock({
    ...input,
    hospitalReference,
    hospital,
    availabilityReference,
    hospitalName: String(hospital.name ?? "Hospital"),
    source: "admin_call",
    previousAvailability: null,
  });
}

export async function approveAvailabilityRequest(input: {
  firestore: Firestore;
  adminUid: string;
  availabilityReference: DocumentReference;
  availability: FirebaseFirestore.DocumentData;
  request: Request;
}) {
  const hospitalReference = input.firestore.collection("hospitals").doc(String(input.availability.hospitalId));
  const hospitalSnapshot = await hospitalReference.get();
  const hospital = hospitalSnapshot.data();
  if (!hospitalSnapshot.exists || !hospital || hospital.status === "archived") throw new Error("The hospital is unavailable.");
  if (!(input.availability.startDate instanceof Timestamp) || !(input.availability.endDate instanceof Timestamp)) throw new Error("The requested dates are invalid.");

  await writeBlock({
    firestore: input.firestore,
    adminUid: input.adminUid,
    hospitalId: hospitalReference.id,
    hospitalReference,
    hospital,
    availabilityReference: input.availabilityReference,
    hospitalName: String(input.availability.hospitalName ?? hospital.name ?? "Hospital"),
    startDate: input.availability.startDate.toDate(),
    endDate: input.availability.endDate.toDate(),
    reason: String(input.availability.reason ?? "Availability requested by hospital"),
    source: "hospital_portal",
    previousAvailability: input.availability,
    request: input.request,
  });
}

async function writeBlock(input: {
  firestore: Firestore;
  adminUid: string;
  hospitalId: string;
  hospitalReference: DocumentReference;
  hospital: FirebaseFirestore.DocumentData;
  availabilityReference: DocumentReference;
  hospitalName: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  source: "hospital_portal" | "admin_call";
  previousAvailability: FirebaseFirestore.DocumentData | null;
  request: Request;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maximumEnd = new Date(input.startDate);
  maximumEnd.setFullYear(maximumEnd.getFullYear() + 1);
  if (input.startDate < today || input.endDate < input.startDate || input.endDate > maximumEnd) {
    throw new Error("Choose a future date range no longer than one year.");
  }
  const ranges = activeRanges(input.hospital.blockedDateRanges);
  if (ranges.length >= 20) throw new Error("This hospital already has 20 upcoming availability blocks. Remove or complete an existing block first.");
  const now = FieldValue.serverTimestamp();
  const startDate = Timestamp.fromDate(input.startDate);
  const endDate = Timestamp.fromDate(input.endDate);
  const updatedRanges = [...ranges, { availabilityId: input.availabilityReference.id, startDate, endDate }];
  const availabilityAudit = input.firestore.collection("auditLogs").doc();
  const hospitalAudit = input.firestore.collection("auditLogs").doc();
  const availabilityData = {
    ...(input.previousAvailability ?? {}),
    hospitalId: input.hospitalId,
    hospitalName: input.hospitalName,
    startDate,
    endDate,
    reason: input.reason,
    source: input.source,
    status: "blocked",
    reviewedAt: now,
    reviewedBy: input.adminUid,
    createdAt: input.previousAvailability?.createdAt ?? now,
    createdBy: input.previousAvailability?.createdBy ?? input.adminUid,
    updatedAt: now,
    updatedBy: input.adminUid,
    archivedAt: null,
    archivedBy: null,
    lastAuditId: availabilityAudit.id,
  };
  const hospitalChanges = { blockedDateRanges: updatedRanges, updatedAt: now, updatedBy: input.adminUid, lastAuditId: hospitalAudit.id };
  const batch = input.firestore.batch();
  batch.set(input.availabilityReference, availabilityData);
  batch.set(availabilityAudit, {
    action: input.previousAvailability ? "status_change" : "create", module: "availability", recordId: input.availabilityReference.id,
    actorId: input.adminUid, actorRole: "admin", previousValues: input.previousAvailability, updatedValues: availabilityData,
    timestamp: now, source: "server", device: device(input.request),
  });
  batch.update(input.hospitalReference, hospitalChanges);
  batch.set(hospitalAudit, {
    action: "update", module: "hospitals", recordId: input.hospitalId,
    actorId: input.adminUid, actorRole: "admin", previousValues: input.hospital, updatedValues: hospitalChanges,
    timestamp: now, source: "server", device: device(input.request),
  });
  await batch.commit();
}

export async function closeAvailability(input: {
  firestore: Firestore;
  adminUid: string;
  availabilityReference: DocumentReference;
  availability: FirebaseFirestore.DocumentData;
  nextStatus: "rejected" | "cancelled";
  request: Request;
}) {
  const now = FieldValue.serverTimestamp();
  const availabilityAudit = input.firestore.collection("auditLogs").doc();
  const availabilityChanges = {
    status: input.nextStatus,
    reviewedAt: now,
    reviewedBy: input.adminUid,
    updatedAt: now,
    updatedBy: input.adminUid,
    lastAuditId: availabilityAudit.id,
  };
  const batch = input.firestore.batch();
  batch.update(input.availabilityReference, availabilityChanges);
  batch.set(availabilityAudit, {
    action: "status_change", module: "availability", recordId: input.availabilityReference.id,
    actorId: input.adminUid, actorRole: "admin", previousValues: input.availability, updatedValues: availabilityChanges,
    timestamp: now, source: "server", device: device(input.request),
  });

  if (input.availability.status === "blocked") {
    const hospitalReference = input.firestore.collection("hospitals").doc(String(input.availability.hospitalId));
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (hospitalSnapshot.exists && hospital) {
      const hospitalAudit = input.firestore.collection("auditLogs").doc();
      const ranges = activeRanges(hospital.blockedDateRanges).filter((range) => range.availabilityId !== input.availabilityReference.id);
      const hospitalChanges = { blockedDateRanges: ranges, updatedAt: now, updatedBy: input.adminUid, lastAuditId: hospitalAudit.id };
      batch.update(hospitalReference, hospitalChanges);
      batch.set(hospitalAudit, {
        action: "update", module: "hospitals", recordId: hospitalReference.id,
        actorId: input.adminUid, actorRole: "admin", previousValues: hospital, updatedValues: hospitalChanges,
        timestamp: now, source: "server", device: device(input.request),
      });
    }
  }
  await batch.commit();
}
