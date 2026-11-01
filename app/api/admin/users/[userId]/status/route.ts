import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiJson } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { uid, firestore, auth } = await requireActiveAdmin(request);
    const { userId } = await context.params;
    if (!userId || userId.length > 128 || userId.includes("/") || [".", "..", uid].includes(userId)) return apiJson({ error: "Choose a Consumer or Hospital account." }, 400);
    const body = await readJsonBody(request, 2_000) as Record<string, unknown> | null;
    if (!body || (body.status !== "active" && body.status !== "inactive")
      || !(body.expectedAuditId === null || typeof body.expectedAuditId === "string" && body.expectedAuditId.length <= 160)) {
      return apiJson({ error: "Refresh the account list and choose a valid status." }, 400);
    }
    // Re-enabling a disabled Auth account belongs to the existing controlled
    // Hospital activation/setup workflow, not this profile-access switch.
    if (body.status === "active") {
      const account = await auth.getUser(userId);
      if (account.disabled) return apiJson({ error: "This sign-in account is disabled. Review its account setup before making it active." }, 409);
    }
    const reference = firestore.collection("users").doc(userId);
    const audit = firestore.collection("auditLogs").doc();
    const result = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.data();
      if (!previous) return { error: "This account could not be found.", code: 404 };
      if (!["consumer", "hospital"].includes(previous.role)) return { error: "Only Consumer and Hospital accounts can be changed here.", code: 403 };
      if (previous.archivedAt != null || !["active", "inactive"].includes(previous.status)) return { error: "This account cannot be changed from this list.", code: 409 };
      if (previous.role === "hospital" && body.status === "active") {
        if (typeof previous.hospitalId !== "string" || !previous.hospitalId || previous.hospitalId.includes("/")) return { error: "Review this account's hospital assignment first.", code: 409 };
        const hospital = (await transaction.get(firestore.collection("hospitals").doc(previous.hospitalId))).data();
        if (!hospital || hospital.status !== "active" || hospital.archivedAt != null
          || typeof previous.email !== "string" || typeof hospital.email !== "string" || !hospital.email.trim()
          || previous.email.trim().toLowerCase() !== hospital.email.trim().toLowerCase()) {
          return { error: "Activate the assigned hospital and check its official email before enabling this account.", code: 409 };
        }
      }
      if (previous.status === body.status) return { changes: { status: previous.status, ...(typeof previous.lastAuditId === "string" ? { lastAuditId: previous.lastAuditId } : {}) } };
      if ((previous.lastAuditId ?? null) !== body.expectedAuditId) return { error: "This account has changed. Refresh the list before trying again.", code: 409 };
      const now = FieldValue.serverTimestamp();
      const changes = { status: body.status, updatedAt: now, updatedBy: uid, lastAuditId: audit.id };
      transaction.update(reference, changes);
      transaction.create(audit, {
        action: "status_change", module: "users", recordId: userId, actorId: uid, actorRole: "admin",
        previousValues: previous, updatedValues: { ...previous, ...changes }, timestamp: now,
        source: "server", device: requestAuditDevice(request),
      });
      return { changes: { status: body.status, lastAuditId: audit.id } };
    });
    if ("error" in result) return apiJson({ error: result.error }, result.code);
    return apiJson(result);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    console.error("User account status update failed", error instanceof Error ? error.message : "Unknown error");
    return apiJson({ error: "We could not change this account. Refresh the list and try again." }, 503);
  }
}
