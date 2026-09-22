"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HospitalCapacityDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospitalCapacity, saveHospitalCapacity } from "@/services/hospitals/capacityService";
import { PortalToast } from "@/components/portal/PortalToast";

export function AdminHospitalCapacity({ hospitalId }: { hospitalId: string }) {
  const [capacity, setCapacity] = useState<DocumentRecord<HospitalCapacityDocument> | null>(null);
  const [totalRooms, setTotalRooms] = useState("0");
  const [occupiedRooms, setOccupiedRooms] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getHospitalCapacity(hospitalId).then((record) => {
      if (!active) return;
      setCapacity(record);
      setTotalRooms(String(record?.totalRooms ?? 0));
      setOccupiedRooms(String(record?.occupiedRooms ?? 0));
    }).catch(() => {
      if (active) setError("We could not load this hospital's room availability.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [hospitalId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const normalizedTotal = totalRooms.trim() || "0";
    const normalizedOccupied = occupiedRooms.trim() || "0";
    setTotalRooms(normalizedTotal);
    setOccupiedRooms(normalizedOccupied);
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveHospitalCapacity(hospitalId, {
        totalRooms: Number(normalizedTotal),
        occupiedRooms: Number(normalizedOccupied),
      }, capacity, "admin");
      const saved = await getHospitalCapacity(hospitalId);
      setCapacity(saved);
      setTotalRooms(String(saved?.totalRooms ?? normalizedTotal));
      setOccupiedRooms(String(saved?.occupiedRooms ?? normalizedOccupied));
      setMessage("Room availability has been updated.");
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

  return <section className="portal-card portal-capacity-card" aria-labelledby="admin-room-availability-title" aria-busy={loading}>
    <PortalToast message={error} tone="error" />
    <PortalToast message={message} />
    <div className="portal-row-heading">
      <h2 id="admin-room-availability-title">Room availability</h2>
      <span className="portal-status" data-status={available > 0 ? "active" : "pending"}>{loading ? "Loading..." : `${available} available`}</span>
    </div>
    <p>View or update the room totals shared with this hospital&apos;s dashboard.</p>
    <form className="portal-capacity-form" onSubmit={save} noValidate>
      <div className="portal-date-grid">
        <label className="portal-capacity-metric">
          <span className="portal-capacity-metric-heading"><span>Total rooms</span><small>Edit</small></span>
          <span className="portal-capacity-metric-value"><input aria-label="Total rooms" type="number" min="0" max="10000" step="1" value={totalRooms} disabled={loading} onChange={(event) => setTotalRooms(event.target.value)} onBlur={() => setTotalRooms((value) => value.trim() || "0")} /><span>rooms</span></span>
        </label>
        <label className="portal-capacity-metric">
          <span className="portal-capacity-metric-heading"><span>Occupied</span><small>Edit</small></span>
          <span className="portal-capacity-metric-value"><input aria-label="Occupied rooms" type="number" min="0" max={Math.max(total, 0)} step="1" value={occupiedRooms} disabled={loading} onChange={(event) => setOccupiedRooms(event.target.value)} onBlur={() => setOccupiedRooms((value) => value.trim() || "0")} /><span>rooms</span></span>
        </label>
        <div><span>Available</span><strong>{available}</strong></div>
        <div><span>Occupancy</span><strong>{occupancy}%</strong></div>
      </div>
      <div className="portal-actions"><button className="portal-button" disabled={saving || loading}>{saving ? "Saving..." : "Update room availability"}</button></div>
    </form>
  </section>;
}
