"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import { Timestamp } from "firebase/firestore";
import { COLLECTIONS } from "@/constants/firestore";
import { countDocuments, sumDocuments } from "@/services/firestore/firestoreService";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCalendarMonthRange } from "@/utils/date";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type DashboardStats = {
  activeHospitals: number | null;
  pendingHospitals: number | null;
  inactiveHospitals: number | null;
  consumers: number | null;
  monthlyBookings: number | null;
  monthlyCommission: number | null;
  pendingAvailability: number | null;
};

const EMPTY_STATS: DashboardStats = {
  activeHospitals: null,
  pendingHospitals: null,
  inactiveHospitals: null,
  consumers: null,
  monthlyBookings: null,
  monthlyCommission: null,
  pendingAvailability: null,
};

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthLabel = formatMonthYear();

  useEffect(() => {
    const { start, end } = getCalendarMonthRange();
    const createdThisMonth = [
      { field: "createdAt", operator: ">=" as const, value: Timestamp.fromDate(start) },
      { field: "createdAt", operator: "<" as const, value: Timestamp.fromDate(end) },
    ];
    const completedThisMonth = [
      { field: "completedAt", operator: ">=" as const, value: Timestamp.fromDate(start) },
      { field: "completedAt", operator: "<" as const, value: Timestamp.fromDate(end) },
    ];

    void Promise.allSettled([
      countDocuments(COLLECTIONS.hospitals, [{ field: "status", operator: "==", value: "active" }]),
      countDocuments(COLLECTIONS.hospitals, [{ field: "status", operator: "==", value: "pending" }]),
      countDocuments(COLLECTIONS.hospitals, [{ field: "status", operator: "==", value: "inactive" }]),
      countDocuments(COLLECTIONS.users, [{ field: "role", operator: "==", value: "consumer" }]),
      countDocuments(COLLECTIONS.bookings, createdThisMonth),
      sumDocuments(COLLECTIONS.bookings, "estimatedCommission", completedThisMonth),
      countDocuments(COLLECTIONS.availability, [{ field: "status", operator: "==", value: "pending" }]),
    ]).then((results) => {
      const resultValue = (result: PromiseSettledResult<number>) =>
        result.status === "fulfilled" ? result.value : null;
      setStats({
        activeHospitals: resultValue(results[0]),
        pendingHospitals: resultValue(results[1]),
        inactiveHospitals: resultValue(results[2]),
        consumers: resultValue(results[3]),
        monthlyBookings: resultValue(results[4]),
        monthlyCommission: resultValue(results[5]),
        pendingAvailability: resultValue(results[6]),
      });
      setError(results.some((result) => result.status === "rejected")
        ? "Some dashboard totals are temporarily unavailable. The available figures are shown below."
        : null);
    }).finally(() => setIsLoading(false));
  }, []);

  const value = (number: number | null) => isLoading || number === null ? "…" : number.toLocaleString("en-IN");

  const hasDashboardData = Object.values(stats).some((number) => number !== null);

  return <PortalShell role="admin" title="Dashboard">
    <PortalLoadGuard loading={isLoading} error={error} hasData={hasDashboardData} fallbackHref="/" loadingMessage="Loading dashboard totals…" />
    {error && <div className="portal-dashboard-feedback"><PortalFeedback error={error} /></div>}
    <div className="portal-welcome">
      <span className="portal-welcome-eyebrow">Ayursarga Platform</span>
      <h2>{getGreeting()}{userProfile ? `, ${userProfile.name.split(" ")[0]}` : ""}.</h2>
      <p>Here is your platform overview for {monthLabel}.</p>
    </div>
    {stats.pendingAvailability !== null && stats.pendingAvailability > 0 && <div className="portal-result-count"><strong>{stats.pendingAvailability}</strong> pending availability request{stats.pendingAvailability !== 1 ? "s" : ""} require attention</div>}
    <div className="portal-grid">
      <article className="portal-card portal-stat portal-stat-hero portal-stat-hospitals">
        <span>Hospitals</span>
        <div className="portal-stat-split">
          <div><strong>{value(stats.activeHospitals)}</strong><small>Active</small></div>
          <div><strong>{value(stats.pendingHospitals)}</strong><small>Pending</small></div>
          <div><strong>{value(stats.inactiveHospitals)}</strong><small>Inactive</small></div>
        </div>
      </article>
      <article className="portal-card portal-stat"><strong>{value(stats.consumers)}</strong><span>Registered consumers</span></article>
      <article className="portal-card portal-stat"><strong>{value(stats.monthlyBookings)}</strong><span>Bookings · {monthLabel}</span></article>
      <article className="portal-card portal-stat"><strong>{isLoading || stats.monthlyCommission === null ? "…" : formatCurrency(stats.monthlyCommission)}</strong><span>Estimated commission · {monthLabel}</span></article>
      <article className="portal-card portal-stat"><strong>{value(stats.pendingAvailability)}</strong><span>Pending availability requests</span></article>
    </div>
    <div className="portal-section-divider" aria-hidden="true"><span className="portal-section-divider-leaf" /></div>
    <nav className="portal-quick-actions" aria-label="Quick actions">
      <Link className="portal-quick-action" href={ROUTES.admin.hospitals}>
        <span className="portal-quick-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></svg></span>
        Review hospitals
      </Link>
      <Link className="portal-quick-action" href={ROUTES.admin.bookings}>
        <span className="portal-quick-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg></span>
        Manage bookings
      </Link>
      <Link className="portal-quick-action" href={ROUTES.admin.availability}>
        <span className="portal-quick-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg></span>
        Availability requests
      </Link>
    </nav>
  </PortalShell>;
}
