import { RequireRole } from "@/components/auth/RequireRole";
import { ConsultationBookings } from "@/components/consultations/ConsultationBookings";
export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  const id = typeof booking === "string" ? booking : undefined;
  return <RequireRole role="consumer" requestedPath={`/app/bookings/consultations${id ? `?booking=${encodeURIComponent(id)}` : ""}`}><ConsultationBookings role="consumer" bookingId={id} /></RequireRole>;
}
