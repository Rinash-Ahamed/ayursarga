import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalBookings } from "@/components/hospital/HospitalBookings";
export default function HospitalBookingsPage() { return <RequireRole role="hospital"><HospitalBookings /></RequireRole>; }
