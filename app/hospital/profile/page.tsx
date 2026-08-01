import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalProfile } from "@/components/hospital/HospitalProfile";
export default function HospitalProfilePage() { return <RequireRole role="hospital"><HospitalProfile /></RequireRole>; }
