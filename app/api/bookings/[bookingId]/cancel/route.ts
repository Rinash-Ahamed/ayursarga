import { createHash } from "node:crypto";
import { after } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { cancellationReason } from "@/features/bookings/cancellation";
import { requireActiveUser, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson, logApiError } from "@/services/api/server";
import { mutationJson } from "@/services/api/mutation";
import { allowRequest } from "@/services/api/rateLimit";
import { withApiTiming } from "@/services/api/timing";
import { requestAuditDevice } from "@/services/api/audit";
import { queueHospitalCancellationEmail, deliverHospitalCancellationEmail } from "@/services/email/consultationEmailService";
import { packageTitle } from "@/features/hospitals/packages";

export const runtime = "nodejs";
export const maxDuration = 60;
class CancellationError extends Error { constructor(message: string, public status: number) { super(message); } }

async function handlePOST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { uid, role, firestore } = await requireActiveUser(request, ["admin", "consumer"]);
    if (!allowRequest(`hospital-booking-cancel:${uid}`, 30, 600000)) return apiJson({ error: "Please wait before cancelling another booking." }, 429);
    const { bookingId } = await context.params;
    if (!bookingId || bookingId.length > 160 || bookingId.includes("/")) return apiJson({ error: "Choose a valid booking." }, 400);
    const input = await readJsonBody(request, 3000) as Record<string, unknown> | null;
    const reason = cancellationReason(input?.cancellationReason);
    if (!reason) return apiJson({ error: "Enter a cancellation reason using 3 to 500 characters." }, 400);
    if (typeof input?.expectedAuditId !== "string" || !input.expectedAuditId || input.expectedAuditId.length > 160) return apiJson({ error: "Refresh the booking before cancelling." }, 400);
    const eventId = createHash("sha256").update(`cancel:${bookingId}`).digest("hex");
    const changes = await firestore.runTransaction(async transaction => {
      const ref = firestore.collection("bookings").doc(bookingId);
      const booking = (await transaction.get(ref)).data();
      if (!booking || booking.archivedAt != null) throw new CancellationError("Booking not found.", 404);
      if (role === "consumer" && booking.consumerId !== uid) throw new CancellationError("You cannot cancel this booking.", 403);
      if (booking.status === "cancelled") {
        if (booking.cancelledBy === uid && booking.cancellationReason === reason) return {
          status: booking.status, cancellationReason: booking.cancellationReason, cancelledBy: booking.cancelledBy,
          cancelledByRole: booking.cancelledByRole, cancelledAt: booking.cancelledAt, lastAuditId: booking.lastAuditId,
          updatedAt: booking.updatedAt, updatedBy: booking.updatedBy,
        };
        throw new CancellationError("This booking is already cancelled. Refresh to view its details.", 409);
      }
      if (booking.lastAuditId !== input.expectedAuditId) throw new CancellationError("This booking changed. Refresh before cancelling.", 409);
      if (!["requested", "confirmed", "reschedule_requested"].includes(booking.status) || (booking.treatmentStatus ?? "not_started") !== "not_started") throw new CancellationError("This booking can no longer be cancelled online. Contact Ayursarga for help.", 409);
      const hospital = !booking.hospitalName && typeof booking.hospitalId === "string" && !booking.hospitalId.includes("/")
        ? (await transaction.get(firestore.collection("hospitals").doc(booking.hospitalId))).data() : null;
      const service = !booking.serviceName && typeof booking.serviceId === "string" && !booking.serviceId.includes("/")
        ? (await transaction.get(firestore.collection("services").doc(booking.serviceId))).data() : null;
      const now = Timestamp.now();
      const audit = firestore.collection("auditLogs").doc();
      const update = { status: "cancelled", cancellationReason: reason, cancelledBy: uid, cancelledByRole: role,
        cancelledAt: now, updatedAt: now, updatedBy: uid, lastAuditId: audit.id };
      transaction.update(ref, update);
      transaction.create(audit, { action: "status_change", module: "bookings", recordId: bookingId, actorId: uid, actorRole: role,
        previousValues: booking, updatedValues: { ...booking, ...update }, timestamp: now, source: "server", device: requestAuditDevice(request) });
      queueHospitalCancellationEmail(transaction, firestore, { eventId, bookingId, booking: { ...booking, ...update,
        hospitalName: booking.hospitalName || hospital?.name || "Hospital details not recorded",
        serviceName: booking.serviceName || (service && service.hospitalId === booking.hospitalId ? packageTitle(service) : "Package details not recorded") },
        actorId: uid, actorRole: role === "admin" ? "admin" : "consumer", auditId: audit.id, now });
      return update;
    });
    // Delivery rechecks the saved revision and claims at most once, including retries.
    after(() => deliverHospitalCancellationEmail(firestore, eventId).then(() => undefined));
    return mutationJson(changes);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof CancellationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/bookings/[bookingId]/cancel", error);
    return apiJson({ error: "Cancellation could not be confirmed. Refresh the booking before trying again." }, 503);
  }
}
export const POST = withApiTiming("POST /api/bookings/[bookingId]/cancel", handlePOST);
