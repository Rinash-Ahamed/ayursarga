import { withApiTiming } from "@/services/api/timing";
import { requireActiveAdmin, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import type { HospitalPackageSummary } from "@/features/hospitals/packageSummary";
import { allowRequest } from "@/services/api/rateLimit";

export const runtime = "nodejs";

async function handlePOST(request: Request) {
  try {
    const { firestore, uid } = await requireActiveAdmin(request);
    if (!allowRequest(`hospital-package-summary:${uid}`, 60, 60_000)) {
      return apiJson({ error: "Please wait a moment before checking package status again." }, 429);
    }
    const body = await readJsonBody(request, 5_000) as { hospitalIds?: unknown } | null;
    const ids = body?.hospitalIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 20 || new Set(ids).size !== ids.length
      || ids.some(id => typeof id !== "string" || !id || id.length > 160 || id.includes("/"))) {
      return apiJson({ error: "Choose up to 20 hospitals to check package status." }, 400);
    }
    const summaries = await firestore.runTransaction(async transaction => {
      const result: Record<string, HospitalPackageSummary> = Object.create(null);
      // Ten hospital IDs x two statuses stays below Firestore's 30-disjunction
      // limit. Project only status fields, never package content. Both chunks
      // share the read-only transaction snapshot and run concurrently.
      const chunks: string[][] = [];
      for (let offset = 0; offset < ids.length; offset += 10) chunks.push(ids.slice(offset, offset + 10));
      await Promise.all(chunks.map(async hospitalIds => {
        const snapshot = await transaction.get(firestore.collection("services")
          .where("hospitalId", "in", hospitalIds).where("archivedAt", "==", null)
          .where("status", "in", ["active", "inactive"])
          .select("hospitalId", "reviewStatus").limit(201));
        if (snapshot.size < 201) {
          hospitalIds.forEach(id => { result[id] = { total: 0, pending: 0, draft: 0, changesRequested: 0, approved: 0 }; });
          for (const document of snapshot.docs) {
            const data = document.data();
            const summary = result[data.hospitalId];
            summary.total++;
            if (data.reviewStatus === "pending") summary.pending++;
            else if (data.reviewStatus === "draft") summary.draft++;
            else if (data.reviewStatus === "changes_requested") summary.changesRequested++;
            else summary.approved++;
          }
          return;
        }
        // Never truncate totals for legacy/high-volume centres. Fall back to
        // exact index counts with bounded concurrency, at the same read time.
        for (let offset = 0; offset < hospitalIds.length; offset += 4) {
          await Promise.all(hospitalIds.slice(offset, offset + 4).map(async (id: string) => {
            const query = firestore.collection("services").where("hospitalId", "==", id)
              .where("archivedAt", "==", null).where("status", "in", ["active", "inactive"]);
            const [total, pending, draft, changes] = await Promise.all([
              transaction.get(query.count()), transaction.get(query.where("reviewStatus", "==", "pending").count()),
              transaction.get(query.where("reviewStatus", "==", "draft").count()), transaction.get(query.where("reviewStatus", "==", "changes_requested").count()),
            ]);
            const counts = { total: total.data().count, pending: pending.data().count, draft: draft.data().count, changesRequested: changes.data().count };
            // Existing packages without review metadata retain their approved state.
            result[id] = { ...counts, approved: Math.max(0, counts.total - counts.pending - counts.draft - counts.changesRequested) };
          }));
        }
      }));
      return result;
    }, { readOnly: true });
    return apiJson({ summaries });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    console.error("Hospital package summary unavailable", error instanceof Error ? error.message : "Unknown error");
    return apiJson({ error: "Package status could not be loaded. Please try again." }, 503);
  }
}

export const POST = withApiTiming("POST /api/admin/hospitals/package-summary", handlePOST);
