"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HospitalCapacityDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { useAuth } from "@/hooks/useAuth";
import { countDocuments } from "@/services/firestore/firestoreService";
import { getHospitalCapacity, saveHospitalCapacity } from "@/services/hospitals/capacityService";
import { COLLECTIONS } from "@/constants/firestore";

type DashboardCounts = { services: number; bookings: number; requested: number; treatments: number };
const EMPTY_COUNTS: DashboardCounts = { services: 0, bookings: 0, requested: 0, treatments: 0 };

export function HospitalDashboard() {
  const { userProfile } = useAuth();
  const hospitalId = userProfile?.hospitalId;
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [capacity, setCapacity] = useState<DocumentRecord<HospitalCapacityDocument> | null>(null);
  const [totalRooms, setTotalRooms] = useState("0");
  const [occupiedRooms, setOccupiedRooms] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hospitalId) return;
    let active = true;
    void Promise.all([
        countDocuments(COLLECTIONS.services, [{ field: "hospitalId", operator: "==", value: hospitalId }]),
        countDocuments(COLLECTIONS.bookings, [{ field: "hospitalId", operator: "==", value: hospitalId }]),
        countDocuments(COLLECTIONS.bookings, [{ field: "hospitalId", operator: "==", value: hospitalId }, { field: "status", operator: "==", value: "requested" }]),
        countDocuments(COLLECTIONS.bookings, [{ field: "hospitalId", operator: "==", value: hospitalId }, { field: "treatmentStatus", operator: "in", value: ["started", "ongoing"] }]),
        getHospitalCapacity(hospitalId),
      ]).then(([services, bookings, requested, treatments, roomCapacity]) => {
      if (!active) return;
      setCounts({ services, bookings, requested, treatments });
      setCapacity(roomCapacity);
      setTotalRooms(String(roomCapacity?.totalRooms ?? 0));
      setOccupiedRooms(String(roomCapacity?.occupiedRooms ?? 0));
    }).catch(() => {
      if (!active) return;
      setError("We could not load the Hospital dashboard. Refresh the page and try again.");
    }).finally(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [hospitalId]);

  async function saveCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospitalId) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      if (!totalRooms.trim() || !occupiedRooms.trim()) throw new Error("Enter both total and occupied treatment rooms.");
      const input = { totalRooms: Number(totalRooms), occupiedRooms: Number(occupiedRooms) };
      await saveHospitalCapacity(hospitalId, input, capacity);
      const saved = await getHospitalCapacity(hospitalId);
      setCapacity(saved);
      setMessage("Treatment room availability has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not update room availability. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const total = Number(totalRooms) || 0;
  const occupied = Number(occupiedRooms) || 0;
  const available = Math.max(0, total - occupied);
  const occupancy = total > 0 ? Math.min(100, Math.round(occupied / total * 100)) : 0;

  return <PortalShell role="hospital" title="Hospital Dashboard">
    <PortalToast message={error} tone="error" />
    <PortalToast message={message} />
    <div className="portal-grid" aria-busy={loading}>
      <article className="portal-card portal-stat"><strong>{loading ? "—" : counts.services}</strong><span>Services</span></article>
      <article className="portal-card portal-stat"><strong>{loading ? "—" : counts.bookings}</strong><span>Total bookings</span></article>
      <article className="portal-card portal-stat"><strong>{loading ? "—" : counts.requested}</strong><span>New requests</span></article>
      <article className="portal-card portal-stat"><strong>{loading ? "—" : counts.treatments}</strong><span>Treatments in progress</span></article>
    </div>

    <section className="portal-card portal-capacity-card" aria-labelledby="room-availability-title">
      <div className="portal-row-heading">
        <div><span className="portal-eyebrow">Treatment occupancy</span><h2 id="room-availability-title">Room availability</h2></div>
        <span className="portal-status" data-status={available > 0 ? "active" : "pending"}>{available} available</span>
      </div>
      <div className="portal-date-grid">
        <div><span>Total rooms</span><strong>{total}</strong></div>
        <div><span>Occupied</span><strong>{occupied}</strong></div>
        <div><span>Available</span><strong>{available}</strong></div>
        <div><span>Occupancy</span><strong>{occupancy}%</strong></div>
      </div>
      <form className="portal-form" onSubmit={saveCapacity} noValidate>
        <label>Total treatment rooms<input type="number" min="0" max="10000" step="1" value={totalRooms} onChange={(event) => setTotalRooms(event.target.value)} required /></label>
        <label>Currently occupied rooms<input type="number" min="0" max={Math.max(total, 0)} step="1" value={occupiedRooms} onChange={(event) => setOccupiedRooms(event.target.value)} required /></label>
        <div className="portal-actions full"><button className="portal-button" disabled={saving || loading}>{saving ? "Saving..." : "Update availability"}</button></div>
      </form>
    </section>
  </PortalShell>;
}
