import Link from "next/link";
export function AdminFinanceNavigation({ active }: { active: "invoices" | "consultants" | "centers" }) {
  return <nav aria-label="Finance sections" className="portal-actions portal-booking-navigation">
    <div className="portal-segmented portal-finance-switch">
      {([['invoices', 'Invoices & Billing'], ['consultants', 'Consultant Finance'], ['centers', 'Wellness Center Finance']] as const).map(([key, label]) =>
        <Link key={key} href={`/admin/finance/${key}`} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
    </div>
  </nav>;
}
