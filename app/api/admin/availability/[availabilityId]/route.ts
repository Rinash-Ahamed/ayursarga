import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson } from "@/services/api/server";
import { approveAvailabilityRequest, closeAvailability } from "@/services/hospitals/availabilityAdmin";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/admin/availability/[availabilityId]", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function PATCH(request: Request, context: { params: Promise<{ availabilityId: string }> }) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await request.json().catch(() => null) as { action?: "approve" | "reject" | "cancel" } | null;
    if (!body?.action || !["approve", "reject", "cancel"].includes(body.action)) return apiJson({ error: "Select a valid availability action." }, 400);
    const { availabilityId } = await context.params;
    const availabilityReference = firestore.collection("availability").doc(availabilityId);
    const snapshot = await availabilityReference.get();
    const availability = snapshot.data();
    if (!snapshot.exists || !availability) return apiJson({ error: "The availability request could not be found." }, 404);

    if (body.action === "approve") {
      if (availability.status !== "pending") return apiJson({ error: "Only a pending request can be approved." }, 409);
      await approveAvailabilityRequest({ firestore, adminUid, availabilityReference, availability, request });
    } else if (body.action === "reject") {
      if (availability.status !== "pending") return apiJson({ error: "Only a pending request can be rejected." }, 409);
      await closeAvailability({ firestore, adminUid, availabilityReference, availability, nextStatus: "rejected", request });
    } else {
      if (availability.status !== "blocked") return apiJson({ error: "Only an active block can be removed." }, 409);
      await closeAvailability({ firestore, adminUid, availabilityReference, availability, nextStatus: "cancelled", request });
    }
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    return apiJson({ error: error instanceof Error ? error.message : "We could not update availability." }, 400);
  }
}
