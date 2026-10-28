import { RequireRole } from "@/components/auth/RequireRole";
import { AdminSecurity } from "@/components/admin/AdminSecurity";
import { isAdminMfaRecoveryEnabled } from "@/config/adminMfaRecovery";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return <RequireRole role="admin"><AdminSecurity enabled={isAdminMfaRecoveryEnabled()} /></RequireRole>;
}
