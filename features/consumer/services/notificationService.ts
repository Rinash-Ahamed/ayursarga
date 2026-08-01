export type NotificationPermissionResult = "granted" | "denied" | "unsupported";

/** Interface placeholder for a future web-push or Capacitor implementation. */
export const notificationService = {
  isSupported() {
    return typeof window !== "undefined" && "Notification" in window;
  },
  async requestPermission(): Promise<NotificationPermissionResult> {
    if (!this.isSupported()) return "unsupported";
    return (await Notification.requestPermission()) === "granted" ? "granted" : "denied";
  },
};
