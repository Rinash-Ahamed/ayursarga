import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

export function PortalRouteLoading() {
  return <PortalLoadGuard loading fallbackHref="/" />;
}
