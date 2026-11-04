import "server-only";
import { Timestamp, type Firestore, type Transaction, type DocumentData } from "firebase-admin/firestore";
import { intervalsOverlap, minutesOfTime, type AppointmentSlot } from "@/features/consultations/slots";

export class SlotReservationError extends Error { constructor(message: string, public status = 409) { super(message); } }
type Entry = { ownerId: string; startTime: string; endTime: string; state: "held" | "booked" | "released"; expiresAt: number | null };
type ScheduleDay = { ref: FirebaseFirestore.DocumentReference; data: DocumentData | null; entries: Record<string, Entry>; bookings: Array<{ id: string; startTime: string; endTime: string }> };

function legacyScheduleQuery(firestore: Firestore, consultantId: string) {
  return firestore.collection("consultationBookings").where("consultantId", "==", consultantId).where("status", "in", ["requested", "confirmed", "completed"])
    .select("archivedAt", "status", "confirmedDate", "preferredDate", "confirmedTime", "slotStartTime", "confirmedEndTime", "slotEndTime");
}

/** One shared day document serializes every overlapping range, including mixed services. */
export async function readScheduleDay(transaction: Transaction, firestore: Firestore, consultantId: string, date: string): Promise<ScheduleDay> {
  const ref = firestore.collection("consultationSlotDays").doc(`${consultantId}_${date}`);
  const query = legacyScheduleQuery(firestore, consultantId);
  const [day, confirmed, preferred] = await Promise.all([
    transaction.get(ref), transaction.get(query.where("confirmedDate", "==", date).limit(201)),
    transaction.get(query.where("preferredDate", "==", date).limit(201)),
  ]);
  return scheduleDay(ref, day, confirmed, preferred, date);
}

/** Bounded discovery page: one day-document batch, legacy lookups in parallel.
 * Keep each consultant's original 201-result overflow guard and both date indexes.
 */
export async function readScheduleDays(transaction: Transaction, firestore: Firestore, consultantIds: string[], date: string): Promise<Map<string, ScheduleDay>> {
  const ids = [...new Set(consultantIds)];
  if (ids.length > 8) throw new SlotReservationError("Choose a smaller availability page.", 400);
  if (!ids.length) return new Map();
  const refs = ids.map(id => firestore.collection("consultationSlotDays").doc(`${id}_${date}`));
  const [days, legacy] = await Promise.all([
    transaction.getAll(...refs),
    Promise.all(ids.map(async id => {
      const query = legacyScheduleQuery(firestore, id);
      return Promise.all([transaction.get(query.where("confirmedDate", "==", date).limit(201)), transaction.get(query.where("preferredDate", "==", date).limit(201))]);
    })),
  ]);
  return new Map(ids.map((id, index) => [id, scheduleDay(refs[index], days[index], legacy[index][0], legacy[index][1], date)]));
}

function scheduleDay(ref: FirebaseFirestore.DocumentReference, day: FirebaseFirestore.DocumentSnapshot,
  confirmed: FirebaseFirestore.QuerySnapshot, preferred: FirebaseFirestore.QuerySnapshot, date: string): ScheduleDay {
  if (confirmed.size >= 201 || preferred.size >= 201) throw new SlotReservationError("This day's schedule needs review. Choose another date or contact Ayursarga.", 503);
  const bookings = new Map([...confirmed.docs, ...preferred.docs].map(doc => [doc.id, doc.data()]));
  const intervals: ScheduleDay["bookings"] = [];
  for (const [id, booking] of bookings) {
    if (booking.archivedAt != null || !["requested", "confirmed", "completed"].includes(booking.status) || (booking.confirmedDate ?? booking.preferredDate) !== date) continue;
    const startTime = booking.confirmedTime || booking.slotStartTime;
    const endTime = booking.confirmedEndTime || booking.slotEndTime;
    // Legacy appointments have no promised duration: retain the quoted window
    // end rather than silently assuming a new 30/60-minute historical duration.
    intervals.push({ id, startTime: typeof startTime === "string" && Number.isFinite(minutesOfTime(startTime)) ? startTime : "00:00",
      endTime: typeof endTime === "string" && endTime > startTime ? endTime : "24:00" });
  }
  const data = day.exists ? day.data()! : null;
  return { ref, data, entries: { ...(data?.entries ?? {}) }, bookings: intervals };
}

export function slotState(day: ScheduleDay, slot: { startTime: string; endTime: string }, now: number, excludeOwner?: string): AppointmentSlot["status"] {
  if (day.bookings.some(booking => booking.id !== excludeOwner && intervalsOverlap(booking, slot))) return "booked";
  let reserved = false;
  for (const entry of Object.values(day.entries)) {
    if (entry.ownerId === excludeOwner || !intervalsOverlap(entry, slot)) continue;
    if (entry.state === "booked") return "booked";
    if (entry.state === "held" && (entry.expiresAt ?? 0) > now) reserved = true;
  }
  return reserved ? "reserved" : "available";
}

export function requireFreeSlot(day: ScheduleDay, slot: { startTime: string; endTime: string }, now: number, excludeOwner?: string) {
  if (slotState(day, slot, now, excludeOwner) !== "available") throw new SlotReservationError("This appointment time was just taken. Choose another available time.");
}
export function ownsLiveHold(day: ScheduleDay, ownerId: string, startTime: string, endTime: string, now: number) {
  const entry = day.entries[startTime];
  return entry?.ownerId === ownerId && entry.state === "held" && entry.endTime === endTime && (entry.expiresAt ?? 0) > now;
}

/** Day index retains a bounded latest state per minute-of-day; prior claims remain in immutable audits/intents. */
export function saveSlotEntry(transaction: Transaction, firestore: Firestore, day: ScheduleDay, entry: Entry, actorId: string, actorRole: "admin" | "consumer", now = Timestamp.now()) {
  const previous = day.entries[entry.startTime] ?? null;
  day.entries[entry.startTime] = entry;
  const audit = firestore.collection("auditLogs").doc();
  transaction.set(day.ref, { ...(day.data ?? {}), consultantId: day.ref.id.slice(0, day.ref.id.lastIndexOf("_")), date: day.ref.id.slice(-10), entries: { ...day.entries },
    createdAt: day.data?.createdAt ?? now, createdBy: day.data?.createdBy ?? actorId, archivedAt: null, archivedBy: null,
    updatedAt: now, updatedBy: actorId, lastAuditId: audit.id });
  transaction.create(audit, { action: previous ? "update" : "create", module: "consultationSlotDays", recordId: day.ref.id,
    previousValues: previous, updatedValues: entry, actorId, actorRole, timestamp: now, source: "server" });
}

export function releaseSlot(transaction: Transaction, firestore: Firestore, day: ScheduleDay, ownerId: string, actorId: string, actorRole: "admin" | "consumer", now = Timestamp.now()) {
  for (const entry of Object.values(day.entries)) if (entry.ownerId === ownerId && entry.state !== "released") {
    saveSlotEntry(transaction, firestore, day, { ...entry, state: "released", expiresAt: null }, actorId, actorRole, now);
  }
}
