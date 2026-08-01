export function PortalFeedback({ error, empty }: { error?: string | null; empty?: string }) {
  if (error) return <p className="portal-form-error" role="alert">{error}</p>;
  if (empty) return <p className="portal-empty">{empty}</p>;
  return null;
}
