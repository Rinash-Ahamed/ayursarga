import { RequireRole } from "@/components/auth/RequireRole";
import { ConsultantsManager } from "@/components/admin/ConsultantsManager";

export default function AdminConsultantsPage() {
  return <RequireRole role="admin"><ConsultantsManager /></RequireRole>;
}
