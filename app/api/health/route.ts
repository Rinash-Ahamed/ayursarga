import { type NextRequest, NextResponse } from "next/server";
import { apiHealth } from "@/services/api/server";
import { isContactEmailReady } from "@/services/contact/contactEmailService";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/health", request.url), 307);
  }

  return apiHealth("/api/health", [
    { name: "firebase-admin", ready: isFirebaseAdminReady() },
    { name: "contact-email", ready: isContactEmailReady() },
  ]);
}
