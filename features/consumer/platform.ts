/** Provider-neutral contracts shared by the web app and a future Capacitor shell. */
export type ConsumerRuntime = "web" | "pwa" | "capacitor";

export interface ConsumerStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ConsumerPlatform {
  runtime: ConsumerRuntime;
  isNative: boolean;
  openExternalUrl(url: string): Promise<void>;
}
