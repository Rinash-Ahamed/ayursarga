"use client";
import { useSyncExternalStore } from "react";

let current: number | null = null;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    const update = () => { current = Date.now(); listeners.forEach(notify => notify()); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    stop = () => { window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
    update();
  }
  return () => { listeners.delete(listener); if (!listeners.size) { stop?.(); stop = null; } };
}
/** One shared viewport clock; hydration uses null, never a server-generated current time. */
export function usePortalClock() { return useSyncExternalStore(subscribe, () => current, () => null); }
