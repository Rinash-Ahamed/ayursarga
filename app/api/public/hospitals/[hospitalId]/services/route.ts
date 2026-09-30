import { apiJson } from "@/services/api/server";
import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { publicPageSize, publicServiceProjection, validPublicDocumentId } from "@/services/hospitals/publicProjection";
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
    const hospital = await firestore.collection("hospitals").doc(hospitalId).get();
    if (!hospital.exists || hospital.data()?.status !== "active" || hospital.data()?.isPublic !== true) {
      return apiJson({ error: "The Ayurvedic centre could not be found." }, 404);
    }
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
    const snapshot = await query.get();
    const page = snapshot.docs.slice(0, pageSize);
    return apiJson({
      documents: page.map((document) => publicServiceProjection(document.id, document.data())),
      cursor: page.at(-1)?.id ?? null,
      hasMore: snapshot.size > pageSize,
    });
  } catch (error) {
    console.error("Public hospital services failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "Centre packages are temporarily unavailable." }, 503);
  }
}
