import Link from "next/link";
import { ROUTES } from "@/config/routes";

/** Route-based switch: each booking flow keeps its own loader, filters and permissions. */
export function AdminBookingNavigation({ active, detail = false }: { active: "hospital" | "consultation"; detail?: boolean }) {
  return <nav className="portal-actions portal-booking-navigation" aria-label="Booking categories">
    <div className="portal-segmented portal-booking-switch">
      <Link href={ROUTES.admin.bookings} aria-current={active === "hospital" ? "page" : undefined}>Hospital bookings</Link>
      <Link href={ROUTES.admin.consultations} aria-current={active === "consultation" ? "page" : undefined}>Online consultations</Link>
    </div>
    {detail && <Link className="portal-button secondary" href={active === "hospital" ? ROUTES.admin.bookings : ROUTES.admin.consultations}>{active === "hospital" ? "View all bookings" : "All online consultations"}</Link>}
  </nav>;
}
