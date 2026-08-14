import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveConsumer } from "@/services/firebase/adminAuthorization";
import { apiHealth, apiJson } from "@/services/api/server";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/consumer/bookings/[bookingId]/rating", [
    { name: "firebaseAdmin", ready: isFirebaseAdminReady() },
  ]);
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { uid, firestore } = await requireActiveConsumer(request);
    const { bookingId } = await context.params;
    const body = await request.json().catch(() => null) as { rating?: unknown } | null;
    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return apiJson({ error: "Choose a rating from 1 to 5 stars." }, 400);
    }

    const bookingReference = firestore.collection("bookings").doc(bookingId);
    const bookingAuditReference = firestore.collection("auditLogs").doc();
    const hospitalAuditReference = firestore.collection("auditLogs").doc();
    const device = {
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
      platform: null,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    };

    const result = await firestore.runTransaction(async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingReference);
      const booking = bookingSnapshot.data();
      if (!bookingSnapshot.exists || booking?.consumerId !== uid) {
        throw new RatingError("This booking is not available for your account.", 404);
      }
      if (booking.status !== "completed") {
        throw new RatingError("A rating can be added after the treatment is completed.", 409);
      }
      if (booking.rating != null) {
        throw new RatingError("A rating has already been submitted for this booking.", 409);
      }

      const hospitalReference = firestore.collection("hospitals").doc(String(booking.hospitalId));
      const hospitalSnapshot = await transaction.get(hospitalReference);
      const hospital = hospitalSnapshot.data();
      if (!hospitalSnapshot.exists) throw new RatingError("The hospital record could not be found.", 404);

      const previousCount = Number(hospital?.ratingCount) || 0;
      const previousAverage = Number(hospital?.ratingAverage) || 0;
      const ratingCount = previousCount + 1;
      const ratingAverage = Math.round(((previousAverage * previousCount + rating) / ratingCount) * 100) / 100;
      const now = FieldValue.serverTimestamp();
      const bookingChanges = {
        rating,
        ratedAt: now,
        updatedAt: now,
        updatedBy: uid,
        lastAuditId: bookingAuditReference.id,
      };
      const hospitalChanges = {
        ratingAverage,
        ratingCount,
        updatedAt: now,
        updatedBy: uid,
        lastAuditId: hospitalAuditReference.id,
      };

      transaction.update(bookingReference, bookingChanges);
      transaction.update(hospitalReference, hospitalChanges);
      transaction.set(bookingAuditReference, {
        action: "update",
        module: "bookings",
        recordId: bookingId,
        actorId: uid,
        actorRole: "consumer",
        previousValues: booking,
        updatedValues: bookingChanges,
        timestamp: now,
        source: "server",
        device,
      });
      transaction.set(hospitalAuditReference, {
        action: "update",
        module: "hospitals",
        recordId: hospitalReference.id,
        actorId: uid,
        actorRole: "consumer",
        previousValues: hospital,
        updatedValues: hospitalChanges,
        timestamp: now,
        source: "server",
        device,
      });
      return { ratingAverage, ratingCount };
    });

    return apiJson({ ok: true, rating, ...result });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RatingError) {
      return apiJson({ error: error.message }, error.status);
    }
    console.error("Booking rating failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not save the rating. Please try again." }, 503);
  }
}

class RatingError extends Error {
  constructor(message: string, public readonly status: 404 | 409) {
    super(message);
    this.name = "RatingError";
  }
}
