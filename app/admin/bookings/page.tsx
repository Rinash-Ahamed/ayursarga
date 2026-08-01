import { RequireRole } from "@/components/auth/RequireRole";
import { AdminBookings } from "@/components/admin/AdminBookings";
export default function AdminBookingsPage() { return <RequireRole role="admin"><AdminBookings /></RequireRole>; }
