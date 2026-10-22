import { RequireRole } from "@/components/auth/RequireRole";
import { ConsultationBookings } from "@/components/consultations/ConsultationBookings";
export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  return <RequireRole role="admin"><ConsultationBookings role="admin" bookingId={typeof booking === "string" ? booking : undefined} /></RequireRole>;
}
