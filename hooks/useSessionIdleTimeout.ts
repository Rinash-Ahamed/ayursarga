"use client";

import { useCallback, useEffect, useRef } from "react";
import { SESSION_IDLE_TIMEOUT_MS } from "@/constants/auth";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "scroll", "touchstart"] as const;
const SESSION_CHECK_EVENTS = ["focus", "pageshow"] as const;
const ACTIVITY_THROTTLE_MS = 1_000;
const WARNING_BEFORE_MS = 2 * 60 * 1_000;

export function useSessionIdleTimeout(enabled: boolean, onTimeout: () => void | Promise<void>, onWarningChange?: (open: boolean) => void, warningEnabled = false) {
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarningChange);
  const resumeRef = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onWarningRef.current = onWarningChange;
  }, [onTimeout, onWarningChange]);

  useEffect(() => {
    if (!enabled) return;

    let lastActivityAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warningTimer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    let warningOpen = false;

    const expire = () => {
      if (expired) return;
      expired = true;
      warningOpen = false;
      onWarningRef.current?.(false);
      if (warningTimer) clearTimeout(warningTimer);
      void onTimeoutRef.current();
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (warningTimer) clearTimeout(warningTimer);
      timer = setTimeout(expire, Math.max(0, SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt)));
      if (warningEnabled) warningTimer = setTimeout(() => {
        if (expired) return;
        if (Date.now() - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) { expire(); return; }
        warningOpen = true;
        onWarningRef.current?.(true);
      }, Math.max(0, SESSION_IDLE_TIMEOUT_MS - WARNING_BEFORE_MS - (Date.now() - lastActivityAt)));
    };

    resumeRef.current = () => {
      if (expired) return false;
      if (Date.now() - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) { expire(); return false; }
      warningOpen = false;
      lastActivityAt = Date.now();
      onWarningRef.current?.(false);
      schedule();
      return true;
    };

    const recordActivity = () => {
      if (expired) return;
      const now = Date.now();
      // An overdue background tab must not regain access from its first click.
      if (now - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) { expire(); return; }
      // Opening/focusing the warning is not an acknowledgement. Require the
      // explicit Stay signed in action once the warning is visible.
      if (warningOpen) return;
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
      if (warningTimer) clearTimeout(warningTimer);
      resumeRef.current = null;
      onWarningRef.current?.(false);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity));
      SESSION_CHECK_EVENTS.forEach((event) => window.removeEventListener(event, checkExpiry));
      document.removeEventListener("visibilitychange", checkVisibility);
    };
  }, [enabled, warningEnabled]);
  return useCallback(() => resumeRef.current?.() ?? false, []);
}
