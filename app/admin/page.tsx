import { RequireRole } from "@/components/auth/RequireRole";
import { PortalPlaceholder } from "@/components/auth/PortalPlaceholder";

export default function AdminHomePage() {
  return <RequireRole role="admin"><PortalPlaceholder role="admin" /></RequireRole>;
}
