import { RequireRole } from "@/components/auth/RequireRole";
import { BookingRequestForm } from "@/components/consumer/BookingRequestForm";
export default async function BookingRequestPage({ searchParams }: { searchParams: Promise<{ hospitalId?: string; serviceId?: string }> }) {
  const query = await searchParams;
  return <RequireRole role="consumer"><BookingRequestForm hospitalId={query.hospitalId ?? ""} serviceId={query.serviceId ?? ""} /></RequireRole>;
}
