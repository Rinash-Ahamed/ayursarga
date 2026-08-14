import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiHealth, apiJson } from "@/services/api/server";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export function GET() {
  return apiHealth("/api/admin/audits", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function DELETE(request: Request) {
  try {
    const { firestore } = await requireActiveAdmin(request);
    let deletedCount = 0;
    for (let batchNumber = 0; batchNumber < 250; batchNumber += 1) {
      const snapshot = await firestore.collection("auditLogs").limit(400).get();
      if (snapshot.empty) return apiJson({ ok: true, deletedCount });
      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deletedCount += snapshot.size;
    }
    return apiJson({ error: "The audit log is unusually large. Run Clear all audits again to finish." }, 409);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    console.error("Audit log clearing failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not clear the audit log. Check the server Firebase Admin configuration and try again." }, 503);
  }
}
