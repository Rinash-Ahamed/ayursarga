import { RequireRole } from "@/components/auth/RequireRole";
import { BookingRequestForm } from "@/components/consumer/BookingRequestForm";
export default async function BookingRequestPage({ searchParams }: { searchParams: Promise<{ hospitalId?: string; serviceId?: string }> }) {
  const query = await searchParams;
  const bookingQuery = new URLSearchParams();
  if (query.hospitalId) bookingQuery.set("hospitalId", query.hospitalId);
  if (query.serviceId) bookingQuery.set("serviceId", query.serviceId);
  const requestedPath = `/app/bookings/new${bookingQuery.size ? `?${bookingQuery.toString()}` : ""}`;
  return <RequireRole role="consumer" requestedPath={requestedPath}><BookingRequestForm hospitalId={query.hospitalId ?? ""} serviceId={query.serviceId ?? ""} /></RequireRole>;
}
