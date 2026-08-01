import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalsManager } from "@/components/admin/HospitalsManager";
export default function AdminHospitalsPage() { return <RequireRole role="admin"><HospitalsManager /></RequireRole>; }
