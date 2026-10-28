/** Only Firebase-issued token claims establish MFA, never profile fields/client flags. */
export function hasAdminTotpSession(claims: Record<string, unknown>) {
  const firebase = claims.firebase as Record<string, unknown> | undefined;
  return claims.email_verified === true
    && firebase?.sign_in_provider === "password"
    && firebase.sign_in_second_factor === "totp";
}

export const isAuthenticatorCode = (code: string) => /^\d{6}$/.test(code);

/** Optional server-managed cutoff: legacy profiles retain their existing behavior. */
export function isAdminSessionAfterCutoff(claims: Record<string, unknown>, cutoff: unknown) {
  if (cutoff === undefined || cutoff === 0) return true;
  return typeof cutoff === "number" && Number.isSafeInteger(cutoff) && cutoff > 0
    && typeof claims.auth_time === "number" && Number.isSafeInteger(claims.auth_time)
    && claims.auth_time > cutoff;
}
