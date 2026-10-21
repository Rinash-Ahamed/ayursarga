import "server-only";

import { getFirebaseClientConfig } from "@/config/firebaseConfig";
import { isFirebaseAdminReady, isFirebaseAdminStorageReady } from "@/services/firebase/admin";
import { isContactEmailReady } from "@/services/contact/contactEmailService";
import { isAuthEmailReady } from "@/services/auth/authEmailService";
import { createApiHealthReport } from "@/services/api/server";

/** Configuration-only: never queries data, generates links or contacts SMTP. */
export function platformHealthReport(deep = false) {
  const firebaseReady = isFirebaseAdminReady();
  const checks = [
    { name: "firebase-admin", ready: firebaseReady },
    { name: "contact-email", ready: isContactEmailReady() },
    { name: "auth-email", ready: firebaseReady && isAuthEmailReady() },
  ];
  if (deep) {
    let clientReady = false;
    try { getFirebaseClientConfig(); clientReady = true; } catch { /* Report status only, never config values. */ }
    checks.push(
      { name: "firebase-client", ready: clientReady },
      { name: "hospital-images", ready: isFirebaseAdminStorageReady() },
    );
  }
  return { ...createApiHealthReport("/api/health", checks), mode: deep ? "deep-configuration" : "configuration" };
}
