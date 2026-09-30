import { apiJson } from "@/services/api/server";
import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { publicHospitalProjection, validPublicDocumentId } from "@/services/hospitals/publicProjection";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    if (!allowRequest(requestFingerprint(request, "public-hospital-detail"), 900, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many centre requests were sent. Please wait a moment and try again." }, 429);
    }
    const { hospitalId: rawHospitalId } = await context.params;
    const hospitalId = validPublicDocumentId(rawHospitalId);
    if (!hospitalId) return apiJson({ error: "The Ayurvedic centre could not be found." }, 404);
    const snapshot = await getFirebaseAdminFirestore().collection("hospitals").doc(hospitalId).get();
    const hospital = snapshot.data();
    if (!snapshot.exists || hospital?.status !== "active" || hospital.isPublic !== true) {
      return apiJson({ error: "The Ayurvedic centre could not be found." }, 404);
    }
    return apiJson({ hospital: publicHospitalProjection(snapshot.id, hospital) });
  } catch (error) {
    console.error("Public hospital details failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "This Ayurvedic centre is temporarily unavailable." }, 503);
  }
}
