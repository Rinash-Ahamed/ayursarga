import { apiHealth } from "@/services/api/server";
import { isContactEmailReady } from "@/services/contact/contactEmailService";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/health", [
    { name: "firebase-admin", ready: isFirebaseAdminReady() },
    { name: "contact-email", ready: isContactEmailReady() },
  ]);
}
