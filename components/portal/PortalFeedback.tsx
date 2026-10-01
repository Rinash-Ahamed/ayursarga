import { PortalToast } from "@/components/portal/PortalToast";

export function PortalFeedback({ error, empty }: { error?: string | null; empty?: string }) {
  if (error) return <PortalToast message={error} tone="error" />;
  if (empty) return <div className="portal-empty-state">
    <div className="portal-empty-state-leaf" aria-hidden="true" />
    <h3>Nothing here yet</h3>
    <p>{empty}</p>
  </div>;
  return null;
}
