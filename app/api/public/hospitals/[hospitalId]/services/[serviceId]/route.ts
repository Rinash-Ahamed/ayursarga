import { apiJson, logApiError } from "@/services/api/server";
import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { publicServiceProjection, validPublicDocumentId } from "@/services/hospitals/publicProjection";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ hospitalId: string; serviceId: string }> }) {
  try {
    if (!allowRequest(requestFingerprint(request, "public-service-detail"), 900, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many package requests were sent. Please wait a moment and try again." }, 429);
    }
    const params = await context.params;
    const hospitalId = validPublicDocumentId(params.hospitalId);
    const serviceId = validPublicDocumentId(params.serviceId);
    if (!hospitalId || !serviceId) return apiJson({ error: "The package could not be found." }, 404);
    const firestore = getFirebaseAdminFirestore();
    const [hospital, service] = await Promise.all([
      firestore.collection("hospitals").doc(hospitalId).get(),
      firestore.collection("services").doc(serviceId).get(),
    ]);
    const hospitalData = hospital.data();
    const serviceData = service.data();
    if (!hospital.exists || hospitalData?.status !== "active" || hospitalData.isPublic !== true
      || !service.exists || serviceData?.status !== "active" || serviceData.hospitalId !== hospitalId) {
      return apiJson({ error: "The package could not be found." }, 404);
    }
    return apiJson({ service: publicServiceProjection(service.id, serviceData) }, 200, { cache: "public-short" });
  } catch (error) {
    logApiError("GET /api/public/hospitals/:hospitalId/services/:serviceId", error);
    return apiJson({ error: "This package is temporarily unavailable." }, 503);
  }
}
