"use client";

import {
  getMultiFactorResolver, multiFactor, TotpMultiFactorGenerator,
  type MultiFactorError, type MultiFactorResolver, type TotpSecret, type User,
} from "firebase/auth";
import { getClientAuth } from "@/services/auth/client";
import { AuthenticationError } from "@/features/auth/errors";
import { hasAdminTotpSession, isAuthenticatorCode } from "@/features/auth/adminMfa";
import { verifyProfileRole } from "@/features/auth/roles";

// Native Firebase session objects/secrets stay only in memory, never in storage,
// Firestore, email, URL parameters, analytics or third-party QR services.
let resolver: MultiFactorResolver | null = null;
let enrollment: { uid: string; secret: TotpSecret } | null = null;

export function clearAdminMfaState() { resolver = null; enrollment = null; }
export function isNativeMfaChallenge(error: unknown): error is MultiFactorError {
  return !!error && typeof error === "object" && "code" in error && error.code === "auth/multi-factor-auth-required";
}
export function captureAdminMfaChallenge(error: MultiFactorError) {
  clearAdminMfaState();
  resolver = getMultiFactorResolver(getClientAuth(), error);
  if (!resolver.hints.some((hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
    clearAdminMfaState(); throw new AuthenticationError("mfa-unavailable");
  }
}
async function resolveTotp(challenge: MultiFactorResolver, code: string) {
  if (!isAuthenticatorCode(code)) throw new AuthenticationError("mfa-invalid-code");
  const factor = challenge.hints.find((hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!factor) throw new AuthenticationError("mfa-unavailable");
  return challenge.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid, code));
}
export async function resolveAdminMfaChallenge(code: string) {
  if (!resolver) throw new AuthenticationError("mfa-session-expired");
  const credential = await resolveTotp(resolver, code);
  clearAdminMfaState();
  return credential.user;
}
export async function resolveMfaReauthentication(error: MultiFactorError, code = "") {
  return resolveTotp(getMultiFactorResolver(getClientAuth(), error), code);
}

export async function assertAdminMfaSession(user: User) {
  if (hasAdminTotpSession((await user.getIdTokenResult()).claims)) return;
  throw new AuthenticationError(multiFactor(user).enrolledFactors.some((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    ? "mfa-sign-in-required" : "mfa-enrollment-required");
}

export async function prepareAdminMfaEnrollment() {
  clearAdminMfaState();
  const user = getClientAuth().currentUser;
  if (!user) throw new AuthenticationError("unauthenticated");
  await user.reload();
  await user.getIdToken(true);
  const { getUserProfile } = await import("@/services/users/userService");
  verifyProfileRole(await getUserProfile(user.uid, user.email ?? "", true), "admin");
  if (!user.emailVerified) throw new AuthenticationError("mfa-email-unverified");
  if (multiFactor(user).enrolledFactors.length) throw new AuthenticationError("mfa-sign-in-required");
  let secret: TotpSecret;
  try { secret = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession()); }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") throw new AuthenticationError("mfa-unavailable");
    throw error;
  }
  enrollment = { uid: user.uid, secret };
  return { key: secret.secretKey, email: user.email ?? "", deadline: secret.enrollmentCompletionDeadline };
}
export async function enrollAdminMfa(code: string) {
  const user = getClientAuth().currentUser;
  if (!user || !enrollment || enrollment.uid !== user.uid) throw new AuthenticationError("mfa-session-expired");
  if (!isAuthenticatorCode(code)) throw new AuthenticationError("mfa-invalid-code");
  await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(enrollment.secret, code), "Ayursarga Admin authenticator");
  enrollment = null;
  await user.getIdToken(true);
  return user;
}

export async function requestAdminEmailVerification() {
  const user = getClientAuth().currentUser;
  if (!user) throw new AuthenticationError("unauthenticated");
  const response = await fetch("/api/auth/admin-email-verification", {
    method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store",
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || body?.ok !== true) throw new Error(body?.error || "Email verification could not be sent. Please try again later.");
}
