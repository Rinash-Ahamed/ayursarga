import { createHash } from "node:crypto";
import { APPROVED_ADMIN_EMAIL } from "@/features/auth/constants";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { authEmailSiteUrl, sendAuthEmail } from "@/services/auth/authEmailService";
import { isEmailReady } from "@/services/email/emailService";
import { apiJson } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { isValidEmail } from "@/utils/text";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") return apiJson({ error: "Use the password reset form on Ayursarga." }, 403);
    const site = authEmailSiteUrl();
    const origin = request.headers.get("origin");
    if (origin && origin !== site && origin !== new URL(request.url).origin) return apiJson({ error: "Use the password reset form on Ayursarga." }, 403);
    if (!allowRequest(requestFingerprint(request, "password-reset"), 5, 15 * 60 * 1000)) return apiJson({ error: "Too many attempts. Please wait and try again." }, 429);
    const input = await readJsonBody(request, 2_000);
    const email = input && typeof input === "object" && !Array.isArray(input) && "email" in input && typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!email || email.length > 160 || !isValidEmail(email)) return apiJson({ error: "Enter a valid email address." }, 400);
    // Configuration failure is independent of account existence.
    if (!isEmailReady()) return apiJson({ error: "Password reset email is temporarily unavailable. Please contact Ayursarga." }, 503);
    const key = createHash("sha256").update(`password-reset:${email}`).digest("hex");
    if (!allowRequest(key, 3, 30 * 60 * 1000) || !allowRequest("password-reset:delivery", 100, 60 * 60 * 1000)) return apiJson({ ok: true });
    try {
      const auth = getFirebaseAdminAuth();
      const user = await auth.getUserByEmail(email);
      const profile = (await getFirebaseAdminFirestore().collection("users").doc(user.uid).get()).data();
      const approvedRoleEmail = profile?.role !== "admin" || email === APPROVED_ADMIN_EMAIL;
      if (!user.disabled && profile?.status === "active" && ["admin", "hospital"].includes(profile.role)
        && approvedRoleEmail
        && String(profile.email ?? "").trim().toLowerCase() === email) {
        await sendAuthEmail(auth, { email, name: String(profile.name ?? ""), role: profile.role });
      }
    } catch (error) {
      // Identical response for absent/ineligible accounts and delivery failures.
      // Never log reset codes, recipient addresses, SMTP credentials or raw errors.
      if ((error as { code?: string })?.code !== "auth/user-not-found") console.error("Ayursarga password reset delivery could not be completed.");
    }
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    console.error("Ayursarga password reset service is unavailable.");
    return apiJson({ error: "Password reset is temporarily unavailable. Please try again later." }, 503);
  }
}
