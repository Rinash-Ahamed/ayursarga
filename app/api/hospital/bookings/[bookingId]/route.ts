import { Timestamp } from "firebase-admin/firestore";
import { mutationJson } from "@/services/api/mutation";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

const BOOKING_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["confirmed", "reschedule_requested", "rejected"],
  reschedule_requested: ["confirmed", "rejected"],
  confirmed: ["reschedule_requested"],
};
const TREATMENT_TRANSITIONS: Record<string, readonly string[]> = {
  not_started: ["started"],
  started: ["ongoing", "completed"],
  ongoing: ["completed"],
  completed: [],
};

export function GET() {
  return apiHealth("/api/hospital/bookings/[bookingId]", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

function parseDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

export async function PATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    if (!allowRequest(requestFingerprint(request, "hospital-booking-update"), 60, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many booking updates were sent. Please wait and try again." }, 429);
    }
    const { uid, profile, firestore } = await requireActiveUser(request, ["hospital"]);
    const hospitalId = String(profile.hospitalId ?? "").trim();
    if (!hospitalId) return apiJson({ error: "Your hospital account is not connected correctly." }, 403);
    const { bookingId } = await context.params;
    if (!bookingId || bookingId.length > 160 || bookingId.includes("/")) return apiJson({ error: "The booking could not be found." }, 404);
    const value = await readJsonBody(request, 6_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) return apiJson({ error: "Booking update details are required." }, 400);
    const body = value as Record<string, unknown>;
    const bookingReference = firestore.collection("bookings").doc(bookingId);
    const [hospitalSnapshot, bookingSnapshot] = await firestore.getAll(
      firestore.collection("hospitals").doc(hospitalId), bookingReference,
    );
    if (!hospitalSnapshot.exists || hospitalSnapshot.data()?.status !== "active") {
      return apiJson({ error: "Only an active hospital can update bookings." }, 403);
    }
    const booking = bookingSnapshot.data();
    if (!bookingSnapshot.exists || !booking || booking.hospitalId !== hospitalId) return apiJson({ error: "The booking could not be found." }, 404);

    const now = Timestamp.now();
    let changes: Record<string, unknown>;
    if (body.action === "booking") {
      const status = String(body.status ?? "");
      if (!BOOKING_TRANSITIONS[String(booking.status ?? "")]?.includes(status)) {
        return apiJson({ error: "This booking status change is not available." }, 409);
      }
      const hospitalNotes = typeof body.hospitalNotes === "string" ? body.hospitalNotes.trim() : "";
      if (hospitalNotes.length > 2_000) return apiJson({ error: "Hospital notes must be 2,000 characters or fewer." }, 400);
      changes = { status, hospitalNotes: hospitalNotes || null };
      if (status === "confirmed" || status === "reschedule_requested") {
        const confirmedDate = parseDate(body.confirmedDate);
        const confirmedTime = typeof body.confirmedTime === "string" ? body.confirmedTime.trim() : "";
        if (!confirmedDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(confirmedTime)) {
          return apiJson({ error: "Enter a valid proposed date and time." }, 400);
        }
        changes.confirmedDate = confirmedDate;
        changes.confirmedTime = confirmedTime;
      }
      if (status === "confirmed") changes.confirmedAt = now;
    } else if (body.action === "treatment") {
      if (booking.status !== "confirmed") return apiJson({ error: "Confirm the booking before updating treatment progress." }, 409);
      const previousTreatment = String(booking.treatmentStatus ?? "not_started");
      const treatmentStatus = String(body.treatmentStatus ?? "");
      if (!TREATMENT_TRANSITIONS[previousTreatment]?.includes(treatmentStatus)) {
        return apiJson({ error: "This treatment status change is not available." }, 409);
      }
      changes = { treatmentStatus };
      if (treatmentStatus === "started") changes.treatmentStartedAt = now;
      if (treatmentStatus === "completed") {
        changes.status = "completed";
        changes.completedAt = now;
        changes.treatmentCompletedAt = now;
      }
    } else {
      return apiJson({ error: "Select a valid booking action." }, 400);
    }

    const auditReference = firestore.collection("auditLogs").doc();
    const metadata = { updatedAt: now, updatedBy: uid, lastAuditId: auditReference.id };
    const updatedValues = { ...booking, ...changes, ...metadata };
    const batch = firestore.batch();
    batch.update(bookingReference, { ...changes, ...metadata }, { lastUpdateTime: bookingSnapshot.updateTime! });
    batch.set(auditReference, {
      action: "status_change", module: "bookings", recordId: bookingId,
      actorId: uid, actorRole: "hospital", previousValues: booking, updatedValues,
      timestamp: now, source: "server", device: requestAuditDevice(request),
    });
    await batch.commit();
    return mutationJson({ ...changes, ...metadata });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/hospital/bookings/[bookingId]", error);
    return apiJson({ error: "We could not update the booking. Please try again." }, 503);
  }
}
