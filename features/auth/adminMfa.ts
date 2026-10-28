/** Only Firebase-issued token claims establish MFA, never profile fields/client flags. */
export function hasAdminTotpSession(claims: Record<string, unknown>) {
  const firebase = claims.firebase as Record<string, unknown> | undefined;
  return claims.email_verified === true
    && firebase?.sign_in_provider === "password"
    && firebase.sign_in_second_factor === "totp";
}

export const isAuthenticatorCode = (code: string) => /^\d{6}$/.test(code);
