import { apiJson } from "@/services/api/server";
import { isContactEmailReady } from "@/services/contact/contactEmailService";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET() {
  const emailReady = isContactEmailReady();
  const firebaseAdminReady = isFirebaseAdminReady();
  const routes = {
    "/api/contact": emailReady ? "ok" : "degraded",
    "/api/admin/audits": firebaseAdminReady ? "ok" : "degraded",
    "/api/admin/hospitals/[hospitalId]/login-setup": firebaseAdminReady ? "ok" : "degraded",
  };
  const ready = Object.values(routes).every((status) => status === "ok");

  return apiJson({
    status: ready ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    routes,
  }, ready ? 200 : 503);
}
