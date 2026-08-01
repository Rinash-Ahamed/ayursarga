import { RequireRole } from "@/components/auth/RequireRole";
import { ServicesManager } from "@/components/hospital/ServicesManager";
export default function HospitalServicesPage() { return <RequireRole role="hospital"><ServicesManager /></RequireRole>; }
