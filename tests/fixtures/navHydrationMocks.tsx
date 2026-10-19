import type { ReactNode } from "react";

declare global { interface Window { navFixturePath: string; } }
export function usePathname() { return typeof window === "undefined" ? "/" : window.navFixturePath; }
export function AuthProvider({ children }: { children: ReactNode }) { return children; }
export function useAuth() {
  return { firebaseUser: null, userProfile: null, role: null, isLoading: false, error: null,
    clearError: () => {}, loginConsumerWithGoogle: async () => {}, logout: async () => {} };
}
export function ModalLayer() { return null; }
export default function MockImage({ src, alt, width, height }: { src?: string; alt?: string; width?: number; height?: number }) {
  // The same default stub replaces the decorative ScrollLogo in this fixture.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt ?? ""} width={width} height={height} /> : null;
}
