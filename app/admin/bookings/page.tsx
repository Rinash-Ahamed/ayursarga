import { RequireRole } from "@/components/auth/RequireRole";
import { AdminBookings } from "@/components/admin/AdminBookings";
export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const query = await searchParams;
  return <RequireRole role="admin"><AdminBookings bookingId={typeof query.booking === "string" ? query.booking : undefined} /></RequireRole>;
}
