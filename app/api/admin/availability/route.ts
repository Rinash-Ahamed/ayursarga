import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson } from "@/services/api/server";
import { AvailabilityOperationError, createAdminBlock } from "@/services/hospitals/availabilityAdmin";
import { readJsonBody, RequestBodyError } from "@/services/api/request";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/admin/availability", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function POST(request: Request) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await readJsonBody(request, 4_000) as Record<string, unknown> | null;
    const hospitalId = String(body?.hospitalId ?? "").trim();
    const startDate = new Date(String(body?.startDate ?? ""));
    const endDate = new Date(String(body?.endDate ?? ""));
    const reason = String(body?.reason ?? "").trim();
    if (!hospitalId || hospitalId.length > 160 || hospitalId.includes("/") || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return apiJson({ error: "Choose a hospital and a valid date range." }, 400);
    }
    if (reason.length < 3 || reason.length > 500) return apiJson({ error: "Enter a short reason between 3 and 500 characters." }, 400);
    await createAdminBlock({ firestore, adminUid, hospitalId, startDate, endDate, reason, request });
    return apiJson({ ok: true }, 201);
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AvailabilityOperationError) return apiJson({ error: error.message }, error.status);
    console.error("Availability block creation failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not block these dates. Review the dates and try again." }, 503);
  }
}
