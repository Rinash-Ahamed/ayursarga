import { withApiTiming } from "@/services/api/timing";
import { FieldValue } from "firebase-admin/firestore";
import { validateConsultantFields } from "@/features/consultants/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { requestAuditDevice } from "@/services/api/audit";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { assertUniqueCreationEmail, DuplicateCreationEmailError } from "@/services/admin/uniqueCreationEmail";

export const runtime = "nodejs";

async function handlePATCH(request: Request, context: { params: Promise<{ consultantId: string }> }) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    const { consultantId } = await context.params;
    if (!/^AS\d{3,}$/.test(consultantId) || consultantId.length > 160) return apiJson({ error: "Invalid consultant reference." }, 400);
    const body = await readJsonBody(request, 8_000) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return apiJson({ error: "Consultant details are required." }, 400);
    const statusChange = body.action === "status_change";
    if (body.action !== "update" && !statusChange) return apiJson({ error: "Invalid consultant action." }, 400);
    if (statusChange && (body.status !== "active" && body.status !== "inactive")) return apiJson({ error: "Select a valid consultant status." }, 400);
    const validation = statusChange ? null : validateConsultantFields(body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields as Record<string, unknown> : {});
    if (validation && !validation.isValid) return apiJson({ error: Object.values(validation.errors)[0] ?? "Consultant details are invalid." }, 400);
    if (typeof body.expectedAuditId !== "string" || body.expectedAuditId.length > 160) return apiJson({ error: "Refresh the consultant list before saving." }, 400);
    const reference = firestore.collection("consultants").doc(consultantId);
    const audit = firestore.collection("auditLogs").doc();
    const result = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.data();
      if (!snapshot.exists || !previous) return 404;
      if (previous.archivedAt != null) return 409;
      if ((previous.lastAuditId ?? "") !== body.expectedAuditId) return 412;
      const emailChanged = !statusChange && validation!.data.email !== previous.email;
      const counter = firestore.collection("systemSettings").doc("consultantSequence");
      if (emailChanged) {
        await transaction.get(counter);
        await assertUniqueCreationEmail(transaction, firestore, "consultants", validation!.data.email, consultantId);
      }
      const now = FieldValue.serverTimestamp();
      // Use the same serialization point as creates; an empty email query alone
      // cannot prevent concurrent creates/edits from claiming the same address.
      if (emailChanged) transaction.set(counter, { updatedAt: now, updatedBy: uid }, { merge: true });
      const changes = { ...(statusChange ? { status: body.status } : validation!.data), updatedAt: now, updatedBy: uid, lastAuditId: audit.id };
      transaction.update(reference, changes);
      transaction.create(audit, {
        action: body.action, module: "consultants", recordId: consultantId,
        actorId: uid, actorRole: "admin", previousValues: previous, updatedValues: { ...previous, ...changes },
        timestamp: now, source: "server", device: requestAuditDevice(request),
      });
      return 200;
    });
    if (result === 404) return apiJson({ error: "The consultant could not be found. Refresh the page." }, 404);
    if (result === 409) return apiJson({ error: "Archived consultants cannot be changed." }, 409);
    if (result === 412) return apiJson({ error: "This consultant has changed since you opened the form. Refresh the list and review the latest details before saving." }, 412);
    return apiJson({ ok: true, lastAuditId: audit.id });
  } catch (error) {
    if (error instanceof DuplicateCreationEmailError) return apiJson({ error: error.message, field: "email" }, error.status);
    if (error instanceof RequestBodyError || error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("/api/admin/consultants/[consultantId]", error);
    return apiJson({ error: "We could not save the consultant. Refresh and try again." }, 503);
  }
}

export const PATCH = withApiTiming("PATCH /api/admin/consultants/[consultantId]", handlePATCH);
