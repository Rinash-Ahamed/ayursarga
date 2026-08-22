"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { COLLECTIONS } from "@/constants/firestore";
import { countDocuments, sumDocuments } from "@/services/firestore/firestoreService";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCalendarMonthRange } from "@/utils/date";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

type DashboardStats = {
  activeHospitals: number | null;
  pendingHospitals: number | null;
  inactiveHospitals: number | null;
  consumers: number | null;
  monthlyBookings: number | null;
  monthlyCommission: number | null;
};

const EMPTY_STATS: DashboardStats = {
  activeHospitals: null,
  pendingHospitals: null,
  inactiveHospitals: null,
  consumers: null,
  monthlyBookings: null,
  monthlyCommission: null,
};

export function AdminDashboard() {
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
      });
      setError(results.some((result) => result.status === "rejected")
        ? "Some dashboard totals are temporarily unavailable. The available figures are shown below."
        : null);
    }).finally(() => setIsLoading(false));
  }, []);

  const value = (number: number | null) => isLoading || number === null ? "—" : number.toLocaleString("en-IN");

  const hasDashboardData = Object.values(stats).some((number) => number !== null);

  return <PortalShell role="admin" title="Admin Dashboard">
    <PortalLoadGuard loading={isLoading} error={error} hasData={hasDashboardData} fallbackHref="/" loadingMessage="Loading dashboard totals…" />
    {error && <div className="portal-dashboard-feedback"><PortalFeedback error={error} /></div>}
    <div className="portal-grid">
      <article className="portal-card portal-stat portal-stat-hospitals">
        <span>Hospitals</span>
        <div className="portal-stat-split">
          <div><strong>{value(stats.activeHospitals)}</strong><small>Active</small></div>
          <div><strong>{value(stats.pendingHospitals)}</strong><small>Pending</small></div>
          <div><strong>{value(stats.inactiveHospitals)}</strong><small>Inactive</small></div>
        </div>
      </article>
      <article className="portal-card portal-stat"><strong>{value(stats.consumers)}</strong><span>Registered consumers</span></article>
      <article className="portal-card portal-stat"><strong>{value(stats.monthlyBookings)}</strong><span>Bookings · {monthLabel}</span></article>
      <article className="portal-card portal-stat"><strong>{isLoading || stats.monthlyCommission === null ? "—" : formatCurrency(stats.monthlyCommission)}</strong><span>Estimated commission · {monthLabel}</span></article>
    </div>
  </PortalShell>;
}
