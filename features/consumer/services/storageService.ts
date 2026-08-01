import type { ConsumerStorage } from "@/features/consumer/platform";

/**
 * Stores non-sensitive consumer preferences on the web. Authentication tokens
 * remain managed by Firebase; personal or clinical data must not be stored here.
 */
export const storageService: ConsumerStorage = {
  async get(key) {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  },
  async set(key, value) {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  async remove(key) {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};
