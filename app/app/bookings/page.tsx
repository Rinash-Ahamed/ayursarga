import { RequireRole } from "@/components/auth/RequireRole";
import { ConsumerBookings } from "@/components/consumer/ConsumerBookings";
export default function ConsumerBookingsPage() { return <RequireRole role="consumer"><ConsumerBookings /></RequireRole>; }
