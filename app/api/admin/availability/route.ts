import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson } from "@/services/api/server";
import { createAdminBlock } from "@/services/hospitals/availabilityAdmin";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/admin/availability", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function POST(request: Request) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const hospitalId = String(body?.hospitalId ?? "").trim();
    const startDate = new Date(String(body?.startDate ?? ""));
    const endDate = new Date(String(body?.endDate ?? ""));
    const reason = String(body?.reason ?? "").trim();
    if (!hospitalId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return apiJson({ error: "Choose a hospital and a valid date range." }, 400);
    }
    if (reason.length < 3 || reason.length > 500) return apiJson({ error: "Enter a short reason between 3 and 500 characters." }, 400);
    await createAdminBlock({ firestore, adminUid, hospitalId, startDate, endDate, reason, request });
    return apiJson({ ok: true }, 201);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    return apiJson({ error: error instanceof Error ? error.message : "We could not block these dates." }, 400);
  }
}
