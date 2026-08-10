import { PortalToast } from "@/components/portal/PortalToast";

export function PortalFeedback({ error, empty }: { error?: string | null; empty?: string }) {
  if (error) return <PortalToast message={error} tone="error" />;
  if (empty) return <p className="portal-empty">{empty}</p>;
  return null;
}
