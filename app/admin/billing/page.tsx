import { RequireRole } from "@/components/auth/RequireRole";
import { AdminBilling } from "@/components/admin/AdminBilling";
export default function BillingPage() { return <RequireRole role="admin"><AdminBilling /></RequireRole>; }
