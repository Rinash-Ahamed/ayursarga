import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isAdminMfaRecoveryEnabled } from "@/config/adminMfaRecovery";
import { allowRequest } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { apiJson } from "@/services/api/server";
import { isAdminSessionAfterCutoff } from "@/features/auth/adminMfa";

export const runtime = "nodejs";

/** Self-service replacement only with an existing, recently MFA-authenticated Admin session. */
export async function POST(request: Request) {
  if (!isAdminMfaRecoveryEnabled()) return apiJson({ error: "Authenticator replacement is disabled." }, 403);
  try {
    const { uid, decoded, auth, firestore } = await requireActiveAdmin(request);
    const age = Math.floor(Date.now() / 1000) - decoded.auth_time;
    if (!Number.isFinite(age) || age < -60 || age > 300) {
      return apiJson({ error: "Verify your Admin password and current authenticator code again." }, 401);
    }
    const body = await request.json().catch(() => null);
    if (!body || body.confirmation !== "replace-my-authenticator" || typeof body.factorId !== "string"
      || !body.factorId || body.factorId.length > 256 || Object.keys(body).some(key => !["confirmation", "factorId"].includes(key))) {
      return apiJson({ error: "Confirm replacement of your own authenticator before continuing." }, 400);
    }
    const account = await auth.getUser(uid);
    const factors = account.multiFactor?.enrolledFactors ?? [];
    if (account.disabled || !account.emailVerified || account.email?.toLowerCase() !== decoded.email?.toLowerCase()
      || factors.length !== 1 || factors[0].factorId !== "totp" || factors[0].uid !== body.factorId) {
      return apiJson({ error: "Your authenticator configuration changed. Sign in again or contact the project owner." }, 409);
    }
    const validAfter = account.tokensValidAfterTime ? Date.parse(account.tokensValidAfterTime) / 1000 : 0;
    if (decoded.auth_time < validAfter) return apiJson({ error: "Sign in again before replacing your authenticator." }, 401);
    if (!allowRequest(`admin-mfa-replacement:${uid}`, 3, 15 * 60 * 1000)) return apiJson({ error: "Please wait before trying again." }, 429);
    // One durable claim per enrolled factor, even across server instances and lost responses.
    // Never retry a potentially completed Auth operation automatically.
    const id = createHash("sha256").update(`${uid}:${body.factorId}`).digest("hex");
    const audit = firestore.collection("auditLogs").doc(`mfa-replacement-${id}`);
    const entry = {
      action: "update", module: "adminSecurity", recordId: uid, actorId: uid, actorRole: "admin",
      previousValues: null, timestamp: FieldValue.serverTimestamp(), source: "web", device: requestAuditDevice(request),
    };
    const cutoff = Math.max(Math.floor(Date.now() / 1000), decoded.auth_time);
    try {
      await firestore.runTransaction(async transaction => {
        const profileRef = firestore.collection("users").doc(uid);
        const snapshot = await transaction.get(profileRef);
        const profile = snapshot.data();
        if (!snapshot.exists || profile?.uid !== uid || profile.role !== "admin" || profile.status !== "active") {
          throw new AdminAuthorizationError("Your Admin account is no longer active.", 403);
        }
        if (!isAdminSessionAfterCutoff(decoded, profile.adminSessionRevokedBefore)) {
          throw new AdminAuthorizationError("Sign in again before replacing your authenticator.", 401);
        }
        transaction.create(audit, { ...entry, previousValues: { adminSessionRevokedBefore: profile.adminSessionRevokedBefore ?? 0 },
          updatedValues: { event: "authenticator_replacement", outcome: "started", adminSessionRevokedBefore: cutoff } });
        transaction.update(profileRef, { adminSessionRevokedBefore: cutoff, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid, lastAuditId: audit.id });
      });
    }
    catch (error) {
      if (error && typeof error === "object" && "code" in error && (error.code === 6 || error.code === "already-exists")) {
        return apiJson({ error: "This replacement was already attempted. Sign in again; contact the project owner if setup is unavailable." }, 409);
      }
      throw error;
    }
    let outcome = "unknown";
    try {
      await auth.updateUser(uid, { multiFactor: { enrolledFactors: [] } });
      await auth.revokeRefreshTokens(uid);
      outcome = "completed";
    } finally {
      // Auth and Firestore cannot commit atomically. Preserve the started claim,
      // append the outcome; never hide an ambiguous mutation by retrying it.
      await firestore.collection("auditLogs").doc(`mfa-replacement-${id}-outcome`).create({
        ...entry, timestamp: FieldValue.serverTimestamp(), updatedValues: { event: "authenticator_replacement", outcome },
      });
    }
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    // Do not expose provider errors, tokens or credentials.
    return apiJson({ error: "Replacement could not be confirmed. Sign out and sign in again to check setup. Contact the project owner before retrying." }, 503);
  }
}
