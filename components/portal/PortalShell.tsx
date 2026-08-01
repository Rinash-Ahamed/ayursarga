"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";

const NAVIGATION = {
  admin: [
    ["Dashboard", ROUTES.admin.home], ["Hospitals", ROUTES.admin.hospitals],
    ["Users", ROUTES.admin.users], ["Bookings", ROUTES.admin.bookings],
  ],
  hospital: [
    ["Dashboard", ROUTES.hospital.home], ["Hospital Profile", ROUTES.hospital.profile],
    ["Services", ROUTES.hospital.services], ["Bookings", ROUTES.hospital.bookings],
  ],
  consumer: [
    ["Hospital Search", ROUTES.consumer.home], ["My Bookings", ROUTES.consumer.bookings],
    ["Profile", ROUTES.consumer.profile],
  ],
} satisfies Record<PortalRole, readonly (readonly [string, string])[]>;

export function PortalShell({ role, title, eyebrow, children }: {
  role: PortalRole; title: string; eyebrow?: string; children: ReactNode;
}) {
  const pathname = usePathname();
  const { userProfile, logout, isLoading } = useAuth();
  return <main className="portal-workspace">
    <aside className="portal-sidebar">
      <Link href="/" className="portal-wordmark">Ayursarga</Link>
      <nav aria-label={`${role} navigation`}>
        {NAVIGATION[role].map(([label, href]) =>
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
      </nav>
      {userProfile ? <div className="portal-account">
        <span>{userProfile.name}</span><small>{userProfile.email}</small>
        <button type="button" onClick={() => void logout()} disabled={isLoading}>Sign out</button>
      </div> : <div className="portal-account portal-account-links">
        <Link href={ROUTES.consumer.login}>Sign in</Link>
        <Link href={ROUTES.consumer.register}>Register</Link>
      </div>}
    </aside>
    <section className="portal-content">
      <header className="portal-page-header">
        <span className="portal-eyebrow">{eyebrow ?? `${role} portal`}</span>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  </main>;
}
