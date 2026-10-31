import { RequireRole } from "@/components/auth/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import { AdminFinanceNavigation } from "@/components/admin/AdminFinanceNavigation";
export default function CenterFinancePage() {
  return <RequireRole role="admin"><PortalShell role="admin" title="Finance"><AdminFinanceNavigation active="centers" />
    <section className="portal-card"><h2>Wellness Center Finance</h2><p>Search Center payment integration is planned for a later phase. Existing hospital package bookings are unchanged.</p><p>No payment collections or center settlements are calculated here until that integration is enabled. Hospital commission invoices remain under Invoices &amp; Billing.</p></section>
  </PortalShell></RequireRole>;
}
