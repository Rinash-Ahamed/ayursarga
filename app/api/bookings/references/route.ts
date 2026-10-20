import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { canAccessBooking, ensureBookingReference } from "@/services/bookings/bookingReferenceAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid, role, profile, firestore } = await requireActiveUser(request, ["admin", "hospital", "consumer"]);
    if (!allowRequest(requestFingerprint(request, `booking-references:${uid}`), 120, 10 * 60 * 1000)) return apiJson({ error: "Please wait before loading more booking references." }, 429);
    const body = await readJsonBody(request, 5_000) as { bookingIds?: unknown } | null;
    if (!Array.isArray(body?.bookingIds) || !body.bookingIds.length || body.bookingIds.length > 20
      || body.bookingIds.some((id) => typeof id !== "string" || !id || id.length > 160 || id.includes("/"))) {
      return apiJson({ error: "Choose between one and twenty valid bookings." }, 400);
    }
    const ids = [...new Set(body.bookingIds as string[])];
    const actor = { uid, role, hospitalId: profile.hospitalId };
    const snapshots = await firestore.getAll(...ids.map((id) => firestore.collection("bookings").doc(id)));
    if (snapshots.some((snapshot) => !snapshot.exists || !canAccessBooking(snapshot.data()!, actor))) return apiJson({ error: "These bookings are not available." }, 403);
    if (role === "hospital") {
      const hospital = await firestore.collection("hospitals").doc(String(profile.hospitalId)).get();
      if (hospital.data()?.status !== "active") return apiJson({ error: "Your hospital is not active." }, 403);
    }
    const entries = await Promise.all(snapshots.map(async (snapshot) => [snapshot.id,
      await ensureBookingReference(firestore, snapshot.id, actor, request),
    ]));
    return apiJson({ references: Object.fromEntries(entries) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/bookings/references", error);
    return apiJson({ error: "Booking references are temporarily unavailable. Please try again." }, 503);
  }
}
