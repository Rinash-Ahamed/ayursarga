type PortalToastTone = "success" | "error" | "info";

export function PortalToast({ message, tone = "success" }: {
  message?: string | null;
  tone?: PortalToastTone;
}) {
  if (!message) return null;
  return <div
    key={`${tone}:${message}`}
    className="portal-toast"
    data-tone={tone}
    role={tone === "error" ? "alert" : "status"}
    aria-live={tone === "error" ? "assertive" : "polite"}
  >
    <span className="portal-toast-mark" aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
    <p>{message}</p>
  </div>;
}
