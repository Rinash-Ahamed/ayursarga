import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";

export const runtime = "nodejs";
export const maxDuration = 60;

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  try {
    const { firestore } = await requireActiveAdmin(request);
    let deletedCount = 0;
    for (let batchNumber = 0; batchNumber < 250; batchNumber += 1) {
      const snapshot = await firestore.collection("auditLogs").limit(400).get();
      if (snapshot.empty) return response({ ok: true, deletedCount });
      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deletedCount += snapshot.size;
    }
    return response({ error: "The audit log is unusually large. Run Clear all audits again to finish." }, 409);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return response({ error: error.message }, error.status);
    console.error("Audit log clearing failed", error instanceof Error ? error.message : error);
    return response({ error: "We could not clear the audit log. Check the server Firebase Admin configuration and try again." }, 503);
  }
}
