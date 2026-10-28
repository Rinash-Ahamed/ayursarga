import "server-only";

/** Off unless explicitly enabled by the trusted hosting operator. Never bypasses MFA. */
export function isAdminMfaRecoveryEnabled() {
  return process.env.ADMIN_MFA_RECOVERY_ENABLED === "true";
}
