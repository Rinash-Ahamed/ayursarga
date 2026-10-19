import { PortalToast } from "@/components/portal/PortalToast";
import type { ToastNotification } from "@/utils/toastNotifications";

export function PortalFeedback({ error, empty, notification }: { error?: string | null; empty?: string; notification?: ToastNotification | null }) {
  if (error) return <PortalToast message={error} notification={notification} tone="error" />;
  if (empty) return <div className="portal-empty-state">
    <div className="portal-empty-state-leaf" aria-hidden="true" />
    <h3>Nothing here yet</h3>
    <p>{empty}</p>
  </div>;
  return null;
}
