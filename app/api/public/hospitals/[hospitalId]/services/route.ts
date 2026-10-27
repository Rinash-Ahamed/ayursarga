import { apiJson, logApiError } from "@/services/api/server";
import { hasPublishedPackage } from "@/features/hospitals/packageReview";
import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { PUBLIC_SERVICE_FIELDS, publicPageSize, publicServiceProjection, validPublicDocumentId } from "@/services/hospitals/publicProjection";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    if (!allowRequest(requestFingerprint(request, "public-hospital-services"), 900, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many package requests were sent. Please wait a moment and try again." }, 429);
    }
    const { hospitalId: rawHospitalId } = await context.params;
    const hospitalId = validPublicDocumentId(rawHospitalId);
    if (!hospitalId) return apiJson({ error: "The Ayurvedic centre could not be found." }, 404);
    const url = new URL(request.url);
    const pageSize = publicPageSize(url.searchParams.get("pageSize"));
    const cursor = validPublicDocumentId(url.searchParams.get("cursor"));
    const firestore = getFirebaseAdminFirestore();
    let query: FirebaseFirestore.Query = firestore.collection("services")
      .where("hospitalId", "==", hospitalId)
      .where("status", "==", "active")
      .orderBy("name", "asc")
      .limit(pageSize + 1);
    if (cursor) {
      const cursorSnapshot = await firestore.collection("services").doc(cursor).get();
      if (cursorSnapshot.exists
        && cursorSnapshot.data()?.hospitalId === hospitalId
        && cursorSnapshot.data()?.status === "active") {
        query = query.startAfter(cursorSnapshot);
      }
    }
    // Independent reads share one wait; never return packages until visibility
    // is verified. Select only the established public package projection.
    const [hospital, snapshot] = await Promise.all([
      firestore.collection("hospitals").doc(hospitalId).get(),
      query.select(...PUBLIC_SERVICE_FIELDS, "reviewStatus", "publishedAt").get(),
    ]);
    if (!hospital.exists || hospital.data()?.status !== "active" || hospital.data()?.isPublic !== true) {
      return apiJson({ error: "The Ayurvedic centre could not be found." }, 404);
    }
    const page = snapshot.docs.slice(0, pageSize);
    return apiJson({
      documents: page.filter((document) => hasPublishedPackage(document.data())).map((document) => publicServiceProjection(document.id, document.data())),
      cursor: page.at(-1)?.id ?? null,
      hasMore: snapshot.size > pageSize,
    });
  } catch (error) {
    logApiError("GET /api/public/hospitals/:hospitalId/services", error);
    return apiJson({ error: "Centre packages are temporarily unavailable." }, 503);
  }
}
