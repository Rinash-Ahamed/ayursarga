export type DeepLinkListener = (url: URL) => void;

/** Browser implementation; a future Capacitor adapter can implement the same API. */
export const deepLinkService = {
  getInitialUrl() {
    return typeof window === "undefined" ? null : new URL(window.location.href);
  },
  subscribe(listener: DeepLinkListener) {
    if (typeof window === "undefined") return () => undefined;
    const onPopState = () => listener(new URL(window.location.href));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  },
};
