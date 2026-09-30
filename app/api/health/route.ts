import { apiJson } from "@/services/api/server";
import { isContactEmailReady } from "@/services/contact/contactEmailService";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET() {
  const emailReady = isContactEmailReady();
  const firebaseAdminReady = isFirebaseAdminReady();
  const ready = emailReady && firebaseAdminReady;

  return apiJson({
    status: ready ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
  }, ready ? 200 : 503);
}
