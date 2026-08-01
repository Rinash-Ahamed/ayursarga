/** Boundaries that keep consumer features portable across web, PWA and Capacitor. */
export type ConsumerRuntime = "web" | "pwa" | "capacitor";

export interface ConsumerStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ConsumerPlatform {
  runtime: ConsumerRuntime;
  storage: ConsumerStorage;
  openExternalUrl(url: string): Promise<void>;
}
