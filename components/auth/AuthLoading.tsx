export function AuthLoading({ label = "Checking your account…" }: { label?: string }) {
  return <div className="auth-loading" role="status" aria-live="polite">
    <span className="auth-loading-mark" aria-hidden="true" />
    <span>{label}</span>
  </div>;
}
