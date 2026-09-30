import { FieldPath } from "firebase-admin/firestore";
import { apiJson, logApiError } from "@/services/api/server";
import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { publicHospitalProjection, publicPageSize, validPublicDocumentId } from "@/services/hospitals/publicProjection";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "public-hospitals"), 600, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many searches were requested. Please wait a moment and try again." }, 429);
    }
    const url = new URL(request.url);
    const pageSize = publicPageSize(url.searchParams.get("pageSize"));
    const cursor = validPublicDocumentId(url.searchParams.get("cursor"));
    const serviceName = (url.searchParams.get("service") ?? "").trim().slice(0, 100);
    const firestore = getFirebaseAdminFirestore();

    if (serviceName) {
      let serviceQuery: FirebaseFirestore.Query = firestore.collection("services")
        .where("name", "==", serviceName)
        .where("status", "==", "active")
        .orderBy(FieldPath.documentId())
        .limit(pageSize + 1);
      if (cursor) {
        const cursorSnapshot = await firestore.collection("services").doc(cursor).get();
        if (cursorSnapshot.exists && cursorSnapshot.data()?.name === serviceName && cursorSnapshot.data()?.status === "active") {
          serviceQuery = serviceQuery.startAfter(cursorSnapshot);
        }
      }
      const serviceSnapshot = await serviceQuery.get();
      const page = serviceSnapshot.docs.slice(0, pageSize);
      const hospitalIds = [...new Set(page.map((document) => String(document.data().hospitalId ?? "")).filter(Boolean))];
      const hospitalSnapshots = hospitalIds.length
        ? await firestore.getAll(...hospitalIds.map((id) => firestore.collection("hospitals").doc(id)))
        : [];
      const documents = hospitalSnapshots
        .filter((document) => document.exists && document.data()?.status === "active" && document.data()?.isPublic === true)
        .map((document) => publicHospitalProjection(document.id, document.data()!))
        .sort((left, right) => String(left.name ?? "").localeCompare(String(right.name ?? "")));
      return apiJson({
        documents,
        cursor: page.at(-1)?.id ?? null,
        hasMore: serviceSnapshot.size > pageSize,
      }, 200, { cache: "public-short" });
    }

    let hospitalQuery: FirebaseFirestore.Query = firestore.collection("hospitals")
      .where("isPublic", "==", true)
      .where("status", "==", "active")
      .orderBy("name", "asc")
      .limit(pageSize + 1);
    if (cursor) {
      const cursorSnapshot = await firestore.collection("hospitals").doc(cursor).get();
      if (cursorSnapshot.exists && cursorSnapshot.data()?.status === "active" && cursorSnapshot.data()?.isPublic === true) {
        hospitalQuery = hospitalQuery.startAfter(cursorSnapshot);
      }
    }
    const snapshot = await hospitalQuery.get();
    const page = snapshot.docs.slice(0, pageSize);
    return apiJson({
      documents: page.map((document) => publicHospitalProjection(document.id, document.data())),
      cursor: page.at(-1)?.id ?? null,
      hasMore: snapshot.size > pageSize,
    }, 200, { cache: "public-short" });
  } catch (error) {
    logApiError("GET /api/public/hospitals", error);
    return apiJson({ error: "Ayurvedic centers are temporarily unavailable." }, 503);
  }
}
