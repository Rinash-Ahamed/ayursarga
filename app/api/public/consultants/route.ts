import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { apiJson, logApiError } from "@/services/api/server";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { consultationService } from "@/features/consultations/catalog";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "public-consultants"), 180, 10 * 60 * 1000)) return apiJson({ error: "Please wait before searching again." }, 429);
    const params = new URL(request.url).searchParams;
    const service = consultationService(params.get("service"));
    if (!service) return apiJson({ error: "Choose a valid consultation service." }, 400);
    const consultantId = params.get("consultantId");
    if (consultantId !== null) {
      if (!/^AS[0-9]{3,}$/.test(consultantId)) return apiJson({ error: "Invalid consultant." }, 400);
      const snapshot = await getFirebaseAdminFirestore().collection("consultants").doc(consultantId).get();
      const consultant = snapshot.exists ? publicConsultantProjection(snapshot.id, snapshot.data()!, service.id) : null;
      return apiJson({ consultant });
    }
    const rawCursor = params.get("cursor");
    if (rawCursor !== null && (!/^\d+$/.test(rawCursor) || !Number.isSafeInteger(Number(rawCursor)) || Number(rawCursor) < 1)) return apiJson({ error: "Invalid page cursor." }, 400);
    let query = getFirebaseAdminFirestore().collection("consultants")
      .where("status", "==", "active").where("consultationServices", "array-contains", service.id)
      .orderBy("employeeSequence", "asc");
    if (rawCursor) query = query.startAfter(Number(rawCursor));
    const snapshot = await query.limit(13).get();
    const page = snapshot.docs.slice(0, 12);
    return apiJson({ documents: page.map((doc) => publicConsultantProjection(doc.id, doc.data(), service.id)).filter(Boolean),
      cursor: page.length ? Number(page[page.length - 1].data().employeeSequence) : null, hasMore: snapshot.docs.length > 12 });
  } catch (error) {
    logApiError("GET /api/public/consultants", error);
    return apiJson({ error: "We could not load consultation professionals. Please try again." }, 503);
  }
}
