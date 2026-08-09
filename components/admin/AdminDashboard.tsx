"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { COLLECTIONS } from "@/constants/firestore";
import { countDocuments, sumDocuments } from "@/services/firestore/firestoreService";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getCalendarMonthRange } from "@/utils/date";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

type DashboardStats = {
  activeHospitals: number;
  pendingHospitals: number;
  consumers: number;
  monthlyBookings: number;
  monthlyCommission: number;
};

const EMPTY_STATS: DashboardStats = {
  activeHospitals: 0,
  pendingHospitals: 0,
  consumers: 0,
  monthlyBookings: 0,
  monthlyCommission: 0,
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

    void Promise.all([
      countDocuments(COLLECTIONS.hospitals, [{ field: "status", operator: "==", value: "active" }]),
      countDocuments(COLLECTIONS.hospitals, [{ field: "status", operator: "==", value: "pending" }]),
      countDocuments(COLLECTIONS.users, [{ field: "role", operator: "==", value: "consumer" }]),
      countDocuments(COLLECTIONS.bookings, createdThisMonth),
      sumDocuments(COLLECTIONS.bookings, "estimatedCommission", completedThisMonth),
    ]).then(([activeHospitals, pendingHospitals, consumers, monthlyBookings, monthlyCommission]) => {
      setStats({ activeHospitals, pendingHospitals, consumers, monthlyBookings, monthlyCommission });
    }).catch(() => {
      setError("We could not load the dashboard totals. Refresh the page and try again.");
    }).finally(() => setIsLoading(false));
  }, []);

  const value = (number: number) => isLoading ? "—" : number.toLocaleString("en-IN");

  return <PortalShell role="admin" title="Admin Dashboard">
    <PortalFeedback error={error} />
    <div className="portal-grid">
      <article className="portal-card portal-stat portal-stat-hospitals">
        <span>Hospitals</span>
        <div className="portal-stat-split">
          <div><strong>{value(stats.activeHospitals)}</strong><small>Active</small></div>
          <div><strong>{value(stats.pendingHospitals)}</strong><small>Pending</small></div>
        </div>
      </article>
      <article className="portal-card portal-stat"><strong>{value(stats.consumers)}</strong><span>Registered consumers</span></article>
      <article className="portal-card portal-stat"><strong>{value(stats.monthlyBookings)}</strong><span>Bookings · {monthLabel}</span></article>
      <article className="portal-card portal-stat"><strong>{isLoading ? "—" : formatCurrency(stats.monthlyCommission)}</strong><span>Estimated commission · {monthLabel}</span></article>
    </div>
  </PortalShell>;
}
