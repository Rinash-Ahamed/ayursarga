import { GuestOnly } from "@/components/auth/RequireRole";
import { LoginForm } from "@/components/auth/LoginForm";
import { isAdminMfaRecoveryEnabled } from "@/config/adminMfaRecovery";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; authenticator?: string | string[] }> }) {
  const { next, authenticator } = await searchParams;
  return <GuestOnly role="admin"><LoginForm role="admin" recoveryEnabled={isAdminMfaRecoveryEnabled()} replacementNotice={authenticator === "setup" ? "setup" : authenticator === "check" ? "check" : undefined} requestedPath={typeof next === "string" ? next : null} /></GuestOnly>;
}
