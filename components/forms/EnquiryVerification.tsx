"use client";

import { useEffect, useRef, useState } from "react";
import type { ContactSource } from "@/features/contact/validation";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }
let scriptPromise: Promise<TurnstileApi> | undefined;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timer = window.setTimeout(fail, 15000);
    function fail() {
      if (settled) return;
      settled = true; window.clearTimeout(timer); script.onload = null; script.onerror = null;
      script.remove(); scriptPromise = undefined; reject(new Error("Verification unavailable"));
    }
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      if (!window.turnstile) { fail(); return; }
      settled = true; window.clearTimeout(timer); script.onload = null; script.onerror = null;
      resolve(window.turnstile);
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Load only near the visible form, not on every page or when browsing Ayu topics. */
export function EnquiryVerification({ source, resetKey, onToken }: {
  source: ContactSource; resetKey: number; onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    let widget: string | undefined;
    let api: TurnstileApi | undefined;
    let started = false;
    const clear = () => onToken("");
    const start = async () => {
      if (started) return;
      started = true;
      clear(); setError("");
      try {
        const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
        if (!sitekey) throw new Error("Verification unavailable");
        api = await loadTurnstile();
        if (cancelled) return;
        widget = api.render(element, {
          sitekey, action: `${source}_enquiry`, theme: "light", size: element.clientWidth < 300 ? "compact" : "flexible", "response-field": false,
          callback: (token: string) => { if (!cancelled) { setError(""); onToken(token); } },
          "expired-callback": () => { if (!cancelled) clear(); },
          "error-callback": () => { if (!cancelled) { clear(); setError("Verification could not load. Please retry or email info@ayursarga.com."); } },
          "timeout-callback": () => { if (!cancelled) { clear(); setError("Verification timed out. Please retry."); } },
        });
      } catch { if (!cancelled) { clear(); setError("Verification is unavailable. Please retry or email info@ayursarga.com."); } }
    };
    const observer: IntersectionObserver | null = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer?.disconnect(); void start(); }
    }, { rootMargin: "200px" }) : null;
    if (observer) observer.observe(element); else void start();
    return () => { cancelled = true; observer?.disconnect(); if (widget !== undefined) api?.remove(widget); };
  }, [source, resetKey, retry, onToken]);
  return <div className="enquiry-verification">
    <p className="enquiry-verification-label">Complete the security verification to send your enquiry.</p>
    <div ref={container} className="enquiry-verification-widget" aria-label="Enquiry security verification" />
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry verification</button></div>}
  </div>;
}
