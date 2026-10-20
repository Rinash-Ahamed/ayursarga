import { RequireRole } from "@/components/auth/RequireRole";
import { ConsumerBookings } from "@/components/consumer/ConsumerBookings";
export default async function ConsumerBookingsPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const query = await searchParams;
  return <RequireRole role="consumer"><ConsumerBookings bookingId={typeof query.booking === "string" ? query.booking : undefined} /></RequireRole>;
}
