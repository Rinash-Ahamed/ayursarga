import { RequireRole } from "@/components/auth/RequireRole";
import { AdminAuditLogs } from "@/components/admin/AdminAuditLogs";

export default function AdminAuditLogsPage() {
  return <RequireRole role="admin"><AdminAuditLogs /></RequireRole>;
}
