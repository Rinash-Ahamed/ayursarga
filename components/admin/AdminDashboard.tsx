"use client";

import { useEffect, useState } from "react";
import { COLLECTIONS } from "@/constants/firestore";
import { countDocuments, runFilteredQuery } from "@/services/firestore/firestoreService";
import type { BookingDocument } from "@/features/firestore/models";
import { formatCurrency } from "@/utils/currency";
import { PortalShell } from "@/components/portal/PortalShell";

export function AdminDashboard() {
  const [stats, setStats] = useState({ hospitals: 0, users: 0, bookings: 0, commission: 0 });
  useEffect(() => { void Promise.all([
    countDocuments(COLLECTIONS.hospitals), countDocuments(COLLECTIONS.users), countDocuments(COLLECTIONS.bookings),
    runFilteredQuery<BookingDocument>({ collectionPath: COLLECTIONS.bookings, filters: [{ field: "status", operator: "==", value: "completed" }], sort: { field: "createdAt", direction: "desc" }, pageSize: 20 }),
  ]).then(([hospitals, users, bookings, completed]) => setStats({ hospitals, users, bookings, commission: completed.documents.reduce((sum, item) => sum + item.estimatedCommission, 0) })).catch(() => undefined); }, []);
  return <PortalShell role="admin" title="Admin Dashboard"><div className="portal-grid">
    <article className="portal-card portal-stat"><strong>{stats.hospitals}</strong><span>Hospitals</span></article>
    <article className="portal-card portal-stat"><strong>{stats.users}</strong><span>Users</span></article>
    <article className="portal-card portal-stat"><strong>{stats.bookings}</strong><span>Bookings</span></article>
    <article className="portal-card portal-stat"><strong>{formatCurrency(stats.commission)}</strong><span>Estimated commission · latest 20 completed</span></article>
  </div></PortalShell>;
}
