import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalBookings } from "@/components/hospital/HospitalBookings";
export default async function HospitalBookingsPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const query = await searchParams;
  return <RequireRole role="hospital"><HospitalBookings bookingId={typeof query.booking === "string" ? query.booking : undefined} /></RequireRole>;
}
