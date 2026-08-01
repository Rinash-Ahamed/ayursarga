"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { useAuth } from "@/hooks/useAuth";
import { countDocuments } from "@/services/firestore/firestoreService";
import { COLLECTIONS } from "@/constants/firestore";

export function HospitalDashboard() {
  const { userProfile } = useAuth(); const hospitalId = userProfile?.hospitalId;
  const [counts, setCounts] = useState({ services: 0, bookings: 0, requested: 0 });
  useEffect(() => { if (!hospitalId) return; void Promise.all([
    countDocuments(COLLECTIONS.services, [{ field: "hospitalId", operator: "==", value: hospitalId }]),
    countDocuments(COLLECTIONS.bookings, [{ field: "hospitalId", operator: "==", value: hospitalId }]),
    countDocuments(COLLECTIONS.bookings, [{ field: "hospitalId", operator: "==", value: hospitalId }, { field: "status", operator: "==", value: "requested" }]),
  ]).then(([services, bookings, requested]) => setCounts({ services, bookings, requested })).catch(() => undefined); }, [hospitalId]);
  return <PortalShell role="hospital" title="Hospital Dashboard"><div className="portal-grid">
    <article className="portal-card portal-stat"><strong>{counts.services}</strong><span>Services</span></article>
    <article className="portal-card portal-stat"><strong>{counts.bookings}</strong><span>Total bookings</span></article>
    <article className="portal-card portal-stat"><strong>{counts.requested}</strong><span>New requests</span></article>
  </div></PortalShell>;
}
