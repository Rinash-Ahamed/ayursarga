"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";

const NAVIGATION = {
  admin: [
    ["Dashboard", ROUTES.admin.home], ["Hospitals", ROUTES.admin.hospitals],
    ["Users", ROUTES.admin.users], ["Bookings", ROUTES.admin.bookings],
    ["Audit Logs", ROUTES.admin.audits],
  ],
  hospital: [
    ["Dashboard", ROUTES.hospital.home], ["Hospital Profile", ROUTES.hospital.profile],
    ["Services", ROUTES.hospital.services], ["Bookings", ROUTES.hospital.bookings],
    ["Change Password", ROUTES.hospital.changePassword],
  ],
  consumer: [
    ["Hospital Search", ROUTES.consumer.home], ["My Bookings", ROUTES.consumer.bookings],
    ["Profile", ROUTES.consumer.profile],
  ],
} satisfies Record<PortalRole, readonly (readonly [string, string])[]>;

export function PortalShell({ role, title, eyebrow, children, focused = false }: {
  role: PortalRole; title: string; eyebrow?: string; children: ReactNode; focused?: boolean;
}) {
  const pathname = usePathname();
  const { userProfile, logout, isLoading } = useAuth();
  const headerEyebrow = role === "hospital" && userProfile?.name
    ? userProfile.name
    : (eyebrow ?? `${role} portal`);

  if (role === "consumer" && focused) {
    return <main className="portal-consumer-focus">
      <header className="portal-consumer-focus-header">
        <Link href="/" className="portal-wordmark" aria-label="Return to Ayursarga home">
          <Image src="/mainlogo.png" alt="" width={40} height={40} loading="eager" quality={90} sizes="40px" />
          <span>Ayursarga</span>
        </Link>
        <h1>{title}</h1>
      </header>
      <section className="portal-consumer-focus-content">{children}</section>
    </main>;
  }

  return <main className="portal-workspace">
    <aside className="portal-sidebar" data-role={role}>
      <Link href="/" className="portal-wordmark" aria-label="Return to Ayursarga home">
        <Image src="/mainlogo.png" alt="" width={44} height={44} loading="eager" quality={90} sizes="44px" />
        <span>Ayursarga</span>
      </Link>
      <nav aria-label={`${role} navigation`}>
        {NAVIGATION[role].map(([label, href]) =>
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className="portal-sidebar-footer">
        {userProfile ? <div className="portal-account">
          <span>{userProfile.name}</span><small>{userProfile.email}</small>
          <button className="portal-signout" type="button" onClick={() => void logout()} disabled={isLoading}>Sign out</button>
        </div> : <div className="portal-account portal-account-links">
          <Link href={ROUTES.consumer.login}>Sign in</Link>
          <Link href={ROUTES.consumer.register}>Register</Link>
        </div>}
        <small className="portal-version">Ayursarga v{process.env.NEXT_PUBLIC_APP_VERSION}</small>
      </div>
    </aside>
    <section className="portal-content">
      <header className="portal-page-header">
        <span className="portal-eyebrow">{headerEyebrow}</span>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  </main>;
}
