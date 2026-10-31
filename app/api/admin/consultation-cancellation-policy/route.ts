import { Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { readConsultationCancellationPolicy } from "@/services/consultations/cancellationPolicyAdmin";
import { parseConsultationCancellationPolicy, DEFAULT_CONSULTATION_CANCELLATION_POLICY } from "@/features/consultations/cancellationPolicy";

export const runtime = "nodejs";
class PolicyConflict extends Error {}
export async function GET(request: Request) {
  try { const { firestore } = await requireActiveAdmin(request); return apiJson({ policy: await readConsultationCancellationPolicy(firestore) }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`cancellation-policy:${uid}`, 20, 600000)) return apiJson({ error: "Please wait before updating the policy again." }, 429);
    const body = await readJsonBody(request, 4000) as Record<string, unknown> | null;
    const policy = parseConsultationCancellationPolicy(body?.policy);
    if (!policy || typeof body?.expectedVersion !== "string" || Object.keys(body).some(key => !["policy", "expectedVersion"].includes(key))
      || Object.keys(body.policy as object).some(key => !Object.keys(DEFAULT_CONSULTATION_CANCELLATION_POLICY).includes(key))) return apiJson({ error: "Enter valid cancellation and refund settings." }, 400);
    const result = await firestore.runTransaction(async transaction => {
      const ref = firestore.collection("cancellationPolicies").doc("consultation");
      const existing = await transaction.get(ref);
      const before = existing.exists ? parseConsultationCancellationPolicy(existing.data()!.policy) : DEFAULT_CONSULTATION_CANCELLATION_POLICY;
      if (!before || before.version !== body.expectedVersion) throw new PolicyConflict("The policy changed. Reload before saving.");
      if (JSON.stringify({ ...policy, version: before.version }) === JSON.stringify(before)) return before;
      const audit = firestore.collection("auditLogs").doc();
      const now = Timestamp.now();
      const updated = { ...policy, version: audit.id };
      const data = { policy: updated, createdAt: existing.data()?.createdAt ?? now, createdBy: existing.data()?.createdBy ?? uid,
        updatedAt: now, updatedBy: uid, archivedAt: null, archivedBy: null, lastAuditId: audit.id };
      transaction.set(ref, data);
      transaction.create(audit, { action: existing.exists ? "update" : "create", module: "cancellationPolicies", recordId: "consultation", actorId: uid,
        actorRole: "admin", previousValues: existing.exists ? { policy: before } : null, updatedValues: data, timestamp: now, source: "server" });
      return updated;
    });
    return apiJson({ policy: result });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
  if (error instanceof PolicyConflict) return apiJson({ error: error.message }, 409);
  return apiJson({ error: "Cancellation policy could not be loaded or saved." }, 503);
}
