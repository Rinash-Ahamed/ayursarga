import type { ConsumerPlatform, ConsumerRuntime } from "@/features/consumer/platform";

type PortableWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

function detectRuntime(): ConsumerRuntime {
  if (typeof window === "undefined") return "web";
  const portableWindow = window as PortableWindow;
  if (portableWindow.Capacitor?.isNativePlatform?.()) return "capacitor";
  if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
  return "web";
}

export const platformService: ConsumerPlatform = {
  get runtime() {
    return detectRuntime();
  },
  get isNative() {
    return detectRuntime() === "capacitor";
  },
  async openExternalUrl(url) {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  },
};
