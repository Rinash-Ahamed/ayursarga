"use client";

import { useEffect, useRef } from "react";
import { SESSION_IDLE_TIMEOUT_MS } from "@/constants/auth";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "scroll", "touchstart"] as const;
const SESSION_CHECK_EVENTS = ["focus", "pageshow"] as const;
const ACTIVITY_THROTTLE_MS = 1_000;

export function useSessionIdleTimeout(enabled: boolean, onTimeout: () => void | Promise<void>) {
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

    let lastActivityAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;

    const expire = () => {
      if (expired) return;
      expired = true;
      void onTimeoutRef.current();
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(expire, Math.max(0, SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt)));
    };

    const recordActivity = () => {
      if (expired) return;
      const now = Date.now();
      if (now - lastActivityAt < ACTIVITY_THROTTLE_MS) return;
      lastActivityAt = now;
      schedule();
    };

    const checkExpiry = () => {
      if (expired) return;
      if (Date.now() - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) expire();
      else recordActivity();
    };

    const checkVisibility = () => {
      if (document.visibilityState === "visible") checkExpiry();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    SESSION_CHECK_EVENTS.forEach((event) => window.addEventListener(event, checkExpiry, { passive: true }));
    document.addEventListener("visibilitychange", checkVisibility);
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity));
      SESSION_CHECK_EVENTS.forEach((event) => window.removeEventListener(event, checkExpiry));
      document.removeEventListener("visibilitychange", checkVisibility);
    };
  }, [enabled]);
}
