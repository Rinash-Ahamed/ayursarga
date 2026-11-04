import { withApiTiming } from "@/services/api/timing";
import { Timestamp } from "firebase-admin/firestore";
import { encodeMutation } from "@/services/api/mutation";
import { validateConsultantFields } from "@/features/consultants/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { assertUniqueCreationEmail, DuplicateCreationEmailError } from "@/services/admin/uniqueCreationEmail";

export const runtime = "nodejs";

async function handlePOST(request: Request) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await readJsonBody(request, 8_000) as Record<string, unknown> | null;
    if (!body) return apiJson({ error: "Consultant details are required." }, 400);
    const validation = validateConsultantFields(body);
    if (!validation.isValid) return apiJson({ error: Object.values(validation.errors)[0] ?? "Consultant details are invalid." }, 400);

    const counterReference = firestore.collection("systemSettings").doc("consultantSequence");
    const auditReference = firestore.collection("auditLogs").doc();
    const result = await firestore.runTransaction(async (transaction) => {
      const counter = await transaction.get(counterReference);
      await assertUniqueCreationEmail(transaction, firestore, "consultants", validation.data.email);
      const latest = await transaction.get(firestore.collection("consultants").orderBy("employeeSequence", "desc").limit(1));
      const currentSequence = Math.max(
        Number(counter.data()?.value ?? 0),
        Number(latest.docs[0]?.data().employeeSequence ?? 0),
      );
      const employeeSequence = currentSequence + 1;
      const employeeId = `AS${String(employeeSequence).padStart(3, "0")}`;
      const consultantReference = firestore.collection("consultants").doc(employeeId);
      const now = Timestamp.now();
      const consultantData = {
        employeeId,
        employeeSequence,
        ...validation.data,
        status: "active",
        createdAt: now,
        createdBy: adminUid,
        updatedAt: now,
        updatedBy: adminUid,
        archivedAt: null,
        archivedBy: null,
        lastAuditId: auditReference.id,
      };
      transaction.set(counterReference, { value: employeeSequence, updatedAt: now, updatedBy: adminUid }, { merge: true });
      transaction.create(consultantReference, consultantData);
      transaction.set(auditReference, {
        action: "create", module: "consultants", recordId: employeeId,
        actorId: adminUid, actorRole: "admin", previousValues: null, updatedValues: consultantData,
        timestamp: now, source: "server",
        device: {
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          platform: null,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
      return { employeeId, consultant: { id: employeeId, ...consultantData } };
    });
    return apiJson({ ok: true, employeeId: result.employeeId, consultant: encodeMutation(result.consultant) }, 201);
  } catch (error) {
    if (error instanceof DuplicateCreationEmailError) return apiJson({ error: error.message, field: "email" }, error.status);
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("/api/admin/consultants", error);
    return apiJson({ error: "We could not add the consultant. Please try again." }, 503);
  }
}

export const POST = withApiTiming("POST /api/admin/consultants", handlePOST);
