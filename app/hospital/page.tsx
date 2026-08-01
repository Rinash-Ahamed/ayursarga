import { RequireRole } from "@/components/auth/RequireRole";
import { PortalPlaceholder } from "@/components/auth/PortalPlaceholder";

export default function HospitalHomePage() {
  return <RequireRole role="hospital"><PortalPlaceholder role="hospital" /></RequireRole>;
}
