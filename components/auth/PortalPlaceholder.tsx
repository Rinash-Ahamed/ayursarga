"use client";

import type { PortalRole } from "@/features/auth/contracts";
import { useAuth } from "@/hooks/useAuth";

const TITLES = {
  admin: "Admin Dashboard",
  hospital: "Hospital Dashboard",
  consumer: "Consumer Home",
} as const;

export function PortalPlaceholder({ role }: { role: PortalRole }) {
  const { userProfile, logout, isLoading } = useAuth();
  return <main className="portal-placeholder">
    <span className="portal-eyebrow">Foundation ready</span>
    <h1>{TITLES[role]}</h1>
    <p>Welcome{userProfile?.name ? `, ${userProfile.name}` : ""}. This secure area is prepared for the next development phase.</p>
    <button type="button" onClick={() => void logout()} disabled={isLoading}>Sign out</button>
  </main>;
}
