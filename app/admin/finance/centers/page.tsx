import { RequireRole } from "@/components/auth/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import { AdminFinanceNavigation } from "@/components/admin/AdminFinanceNavigation";
export default function CenterFinancePage() {
  return <RequireRole role="admin"><PortalShell role="admin" title="Finance"><AdminFinanceNavigation active="centers" />
    <section className="portal-card"><h2>Wellness Center Finance</h2><p>Online payments and settlement tracking for hospital bookings are not available here yet. You can continue managing hospital bookings as usual.</p><p>To create or view hospital commission invoices, choose Invoices &amp; Billing above.</p></section>
  </PortalShell></RequireRole>;
}
