"use client";

import { useEffect, useState } from "react";

export function useBrowserIdle(timeout = 1_200) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelIdle: (() => void) | undefined;

    const schedule = () => {
      const requestIdle = Reflect.get(window, "requestIdleCallback") as typeof window.requestIdleCallback | undefined;
      const cancelBrowserIdle = Reflect.get(window, "cancelIdleCallback") as typeof window.cancelIdleCallback | undefined;
      if (requestIdle && cancelBrowserIdle) {
        const idleId = requestIdle.call(window, () => setReady(true), { timeout });
        cancelIdle = () => cancelBrowserIdle.call(window, idleId);
        return;
      }
      const timeoutId = globalThis.setTimeout(() => setReady(true), Math.min(timeout, 250));
      cancelIdle = () => globalThis.clearTimeout(timeoutId);
    };

    schedule();

    return () => {
      cancelIdle?.();
    };
  }, [timeout]);

  return ready;
}
