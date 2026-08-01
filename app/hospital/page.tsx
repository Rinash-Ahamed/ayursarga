import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalDashboard } from "@/components/hospital/HospitalDashboard";
export default function HospitalPage() { return <RequireRole role="hospital"><HospitalDashboard /></RequireRole>; }
