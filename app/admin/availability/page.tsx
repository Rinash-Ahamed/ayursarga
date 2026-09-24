import { RequireRole } from "@/components/auth/RequireRole";
import { AdminAvailability } from "@/components/admin/AdminAvailability";

export default function AdminAvailabilityPage() {
  return <RequireRole role="admin"><AdminAvailability /></RequireRole>;
}
