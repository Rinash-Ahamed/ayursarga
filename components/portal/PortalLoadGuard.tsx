"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalToast } from "@/components/portal/PortalToast";

export function PortalLoadGuard({
  loading,
  error,
  hasData = false,
  fallbackHref,
  loadingMessage = "Loading this page…",
}: {
  loading: boolean;
  error?: string | null;
  hasData?: boolean;
  fallbackHref: string;
  loadingMessage?: string;
}) {
  const router = useRouter();
  const initialError = !hasData ? error : null;

  useEffect(() => {
    if (!initialError) return;
    const timeout = window.setTimeout(() => {
      if (window.history.length > 1) router.back();
      else router.replace(fallbackHref);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [fallbackHref, initialError, router]);

  if (initialError) return <>
    <PortalToast message={`${initialError} Returning to the previous page.`} tone="error" />
    <div className="portal-load-overlay" role="alert">
      <p>Unable to open this page</p>
      <span>Returning to the previous page…</span>
      <button type="button" className="portal-button secondary" onClick={() => {
        if (window.history.length > 1) router.back();
        else router.replace(fallbackHref);
      }}>Go back now</button>
    </div>
  </>;

  if (loading && !hasData) return <div className="portal-load-overlay portal-loading-screen" role="status" aria-live="polite" aria-busy="true">
    <div className="portal-loading-brand" aria-hidden="true">
      <span className="portal-loading-leaf" />
      <span>Ayursarga</span>
    </div>
    <span className="auth-loading-mark" aria-hidden="true" />
    <p>{loadingMessage}</p>
  </div>;

  return null;
}
