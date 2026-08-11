"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createBookingRequest } from "@/services/bookings/bookingService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";

export function BookingRequestForm({ hospitalId, serviceId }: { hospitalId: string; serviceId: string }) {
  const { firebaseUser, userProfile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser || !userProfile?.phone) return;
    const data = new FormData(event.currentTarget); setBusy(true); setError(null);
    try {
      await createBookingRequest({ consumerId: firebaseUser.uid, consumerName: userProfile.name,
        consumerEmail: userProfile.email, consumerPhone: userProfile.phone, consumerAddress: userProfile.address,
        hospitalId, serviceId,
        preferredDate: new Date(`${String(data.get("date"))}T00:00:00`), preferredTime: String(data.get("time")),
        consumerNotes: String(data.get("notes") || "") });
      router.replace("/app/bookings");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not send your appointment request. Check the details and try again."); }
    finally { setBusy(false); }
  }
  return <PortalShell role="consumer" title="Request an appointment" eyebrow="Booking request">
    <form className="portal-card portal-form" onSubmit={submit}>
      <label>Preferred date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} required /></label>
      <label>Preferred time<input name="time" type="time" required /></label>
      <label className="full">Notes (optional)<textarea name="notes" maxLength={500} /></label>
      <PortalToast message={error} tone="error" />
      <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></div>
    </form>
  </PortalShell>;
}
