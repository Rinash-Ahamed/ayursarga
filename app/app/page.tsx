import { RequireRole } from "@/components/auth/RequireRole";
import { PortalPlaceholder } from "@/components/auth/PortalPlaceholder";

export default function ConsumerHomePage() {
  return <RequireRole role="consumer"><PortalPlaceholder role="consumer" /></RequireRole>;
}
