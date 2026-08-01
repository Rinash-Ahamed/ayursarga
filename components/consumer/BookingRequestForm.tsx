"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createBookingRequest } from "@/services/bookings/bookingService";
import { PortalShell } from "@/components/portal/PortalShell";

export function BookingRequestForm({ hospitalId, serviceId }: { hospitalId: string; serviceId: string }) {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser) return;
    const data = new FormData(event.currentTarget); setBusy(true); setError(null);
    try {
      await createBookingRequest({ consumerId: firebaseUser.uid, hospitalId, serviceId,
        preferredDate: new Date(`${String(data.get("date"))}T00:00:00`), preferredTime: String(data.get("time")),
        consumerNotes: String(data.get("notes") || "") });
      router.replace("/app/bookings");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The request could not be submitted."); }
    finally { setBusy(false); }
  }
  return <PortalShell role="consumer" title="Request an appointment" eyebrow="Booking request">
    <form className="portal-card portal-form" onSubmit={submit}>
      <label>Preferred date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} required /></label>
      <label>Preferred time<input name="time" type="time" required /></label>
      <label className="full">Notes (optional)<textarea name="notes" maxLength={500} /></label>
      {error && <p className="portal-form-error full" role="alert">{error}</p>}
      <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></div>
    </form>
  </PortalShell>;
}
