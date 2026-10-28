import { AdminAuthorizationError, requireVerifiedFirebaseUser } from "@/services/firebase/adminAuthorization";
import { isAuthEmailReady, sendAdminVerificationEmail } from "@/services/auth/authEmailService";
import { allowRequest } from "@/services/api/rateLimit";
import { apiJson } from "@/services/api/server";

export const runtime = "nodejs";

/** Password-only exception for setup, never operational Admin access. No client recipient/URL. */
export async function POST(request: Request) {
  try {
    const { uid, decoded, auth, firestore } = await requireVerifiedFirebaseUser(request);
    const profile = (await firestore.collection("users").doc(uid).get()).data();
    const age = Math.floor(Date.now() / 1000) - decoded.auth_time;
    if (profile?.uid !== uid || profile.role !== "admin" || profile.status !== "active"
      || !decoded.email || String(profile.email).trim().toLowerCase() !== decoded.email.toLowerCase()
      || decoded.firebase.sign_in_provider !== "password" || !Number.isFinite(age) || age < -60 || age > 300) {
      return apiJson({ error: "Sign in again with your Admin password before verifying your email." }, 403);
    }
    if (decoded.email_verified) return apiJson({ ok: true, alreadyVerified: true });
    if (!allowRequest(`admin-email-verification:${uid}`, 3, 15 * 60 * 1000)) {
      return apiJson({ error: "Too many verification requests. Please wait before requesting another email." }, 429);
    }
    if (!isAuthEmailReady()) return apiJson({ error: "Verification email is temporarily unavailable. Please contact the project owner." }, 503);
    await sendAdminVerificationEmail(auth, decoded.email, String(profile.name ?? ""));
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    // Do not log SMTP/link-generation exceptions, which may contain credentials or codes.
    return apiJson({ error: "Verification email delivery could not be confirmed. Check your inbox before requesting another link." }, 502);
  }
}
