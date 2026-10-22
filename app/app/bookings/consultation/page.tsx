import { RequireRole } from "@/components/auth/RequireRole";
import { ConsultationBookingForm } from "@/components/consumer/ConsultationBookingForm";

export default async function ConsultationPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const query = await searchParams;
  const serviceId = typeof query.service === "string" ? query.service : "";
  return <RequireRole role="consumer" requestedPath={`/app/bookings/consultation?service=${encodeURIComponent(serviceId)}`}><ConsultationBookingForm key={serviceId} serviceId={serviceId} /></RequireRole>;
}
