import { PortalToast } from "@/components/portal/PortalToast";
import type { ToastNotification } from "@/utils/toastNotifications";

export function PortalFeedback({ error, empty, emptyTitle = "Nothing here yet", notification }: { error?: string | null; empty?: string; emptyTitle?: string; notification?: ToastNotification | null }) {
  if (error) return <PortalToast message={error} notification={notification} tone="error" />;
  if (empty) return <div className="portal-empty-state" role="status">
    <div className="portal-empty-state-leaf" aria-hidden="true" />
    <h3>{emptyTitle}</h3>
    <p>{empty}</p>
  </div>;
  return null;
}
