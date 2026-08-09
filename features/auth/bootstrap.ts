export const BOOTSTRAP_ADMIN_EMAIL = "info@ayursarga.com";

export function isBootstrapAdminEmail(email: string) {
  return email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}
