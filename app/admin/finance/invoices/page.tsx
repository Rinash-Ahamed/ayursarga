import { RequireRole } from "@/components/auth/RequireRole";
import { AdminBilling } from "@/components/admin/AdminBilling";
export default function FinanceInvoicesPage() { return <RequireRole role="admin"><AdminBilling /></RequireRole>; }
