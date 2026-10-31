import { requireActiveAdmin, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import type { HospitalPackageSummary } from "@/features/hospitals/packageSummary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { firestore } = await requireActiveAdmin(request);
    const body = await readJsonBody(request, 5_000) as { hospitalIds?: unknown } | null;
    const ids = body?.hospitalIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 20 || new Set(ids).size !== ids.length
      || ids.some(id => typeof id !== "string" || !id || id.length > 160 || id.includes("/"))) {
      return apiJson({ error: "Choose up to 20 hospitals to check package status." }, 400);
    }
    const summaries = await firestore.runTransaction(async transaction => {
      const result: Record<string, HospitalPackageSummary> = Object.create(null);
      // Keep reads bounded and limit concurrency. Count queries do not download
      // package content or change review/publication state.
      for (let offset = 0; offset < ids.length; offset += 4) {
        await Promise.all(ids.slice(offset, offset + 4).map(async (id: string) => {
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
      return result;
    }, { readOnly: true });
    return apiJson({ summaries });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    console.error("Hospital package summary unavailable", error instanceof Error ? error.message : "Unknown error");
    return apiJson({ error: "Package status could not be loaded. Please try again." }, 503);
  }
}
