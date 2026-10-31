import { RequireRole } from "@/components/auth/RequireRole";
import { AdminConsultantFinance } from "@/components/admin/AdminConsultantFinance";
export default function ConsultantFinancePage() { return <RequireRole role="admin"><AdminConsultantFinance /></RequireRole>; }
