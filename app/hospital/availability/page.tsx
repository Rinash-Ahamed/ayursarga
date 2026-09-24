import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalAvailability } from "@/components/hospital/HospitalAvailability";

export default function HospitalAvailabilityPage() {
  return <RequireRole role="hospital"><HospitalAvailability /></RequireRole>;
}
