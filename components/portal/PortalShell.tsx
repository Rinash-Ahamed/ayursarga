"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";

type NavigationItem = readonly [label: string, href: string, nested?: boolean];

const NAVIGATION: Record<PortalRole, readonly NavigationItem[]> = {
  admin: [
    ["Dashboard", ROUTES.admin.home], ["Hospitals", ROUTES.admin.hospitals],
    ["Our Consultants", ROUTES.admin.consultants, true],
    ["Users", ROUTES.admin.users], ["Bookings", ROUTES.admin.bookings],
    ["Availability", ROUTES.admin.availability],
    ["Audit Logs", ROUTES.admin.audits],
  ],
  hospital: [
    ["Dashboard", ROUTES.hospital.home], ["Hospital Profile", ROUTES.hospital.profile],
    ["Services", ROUTES.hospital.services], ["Bookings", ROUTES.hospital.bookings],
    ["Availability", ROUTES.hospital.availability],
    ["Change Password", ROUTES.hospital.changePassword],
  ],
  consumer: [],
};

function getAccountInitials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
  return (words[0]?.slice(0, 2) || email.slice(0, 2) || "AS").toUpperCase();
}

export function PortalShell({ role, title, children, focused = false }: {
  role: PortalRole; title: string; children: ReactNode; focused?: boolean;
}) {
  const pathname = usePathname();
  const { userProfile, logout, isLoading } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("portal-menu-open", mobileMenuOpen);
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.classList.remove("portal-menu-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  if (role === "consumer" && focused) {
    return <main className="portal-consumer-focus">
      <header className="portal-consumer-focus-header">
        <Link href="/" className="portal-wordmark" aria-label="Return to Ayursarga home">
          <Image src="/mainlogo.png" alt="" width={40} height={40} loading="eager" quality={90} sizes="40px" />
          <span>Ayursarga</span>
        </Link>
        <div className="portal-consumer-focus-title">
          <span>My Ayursarga</span>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="portal-consumer-focus-content">{children}</section>
    </main>;
  }

  return <main className="portal-workspace">
    <aside className="portal-sidebar" data-role={role} data-mobile-open={mobileMenuOpen || undefined}>
      <div className="portal-sidebar-top">
        <Link href="/" className="portal-wordmark" aria-label="Return to Ayursarga home">
          <Image src="/mainlogo.png" alt="" width={44} height={44} loading="eager" quality={90} sizes="44px" />
          <span>Ayursarga</span>
        </Link>
        <button className="portal-mobile-menu-toggle" type="button" aria-label="Open portal menu" aria-expanded={mobileMenuOpen} aria-controls="portal-mobile-drawer" onClick={() => setMobileMenuOpen(true)}>
          <span /><span /><span />
        </button>
      </div>
      <div className="portal-sidebar-drawer" id="portal-mobile-drawer">
        <div className="portal-mobile-drawer-heading">
          <span>Menu</span>
          <button type="button" aria-label="Close portal menu" onClick={() => setMobileMenuOpen(false)}>×</button>
        </div>
        <nav aria-label={`${role} navigation`}>
          {NAVIGATION[role].map(([label, href, nested]) =>
            <Link className={nested ? "portal-nav-subitem" : undefined} key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => { setAccountOpen(false); setMobileMenuOpen(false); }}>{label}</Link>)}
        </nav>
        {userProfile && role !== "consumer" && <div className="portal-mobile-account">
          <span className="portal-header-account-avatar" aria-hidden="true">{getAccountInitials(userProfile.name, userProfile.email)}</span>
          <div><strong>{userProfile.name}</strong><small>{userProfile.email}</small></div>
          <button className="portal-signout" type="button" onClick={() => { setMobileMenuOpen(false); void logout(); }} disabled={isLoading}>Sign out</button>
        </div>}
        <div className="portal-sidebar-footer">
          <small className="portal-version">Ayursarga v{process.env.NEXT_PUBLIC_APP_VERSION}</small>
        </div>
      </div>
    </aside>
    {mobileMenuOpen && <button className="portal-mobile-menu-backdrop" type="button" aria-label="Close portal menu" onClick={() => setMobileMenuOpen(false)} />}
    <section className="portal-content">
      <header className="portal-page-header">
        <div className="portal-page-heading">
          <h1>{title}</h1>
        </div>
        {userProfile && role !== "consumer" && <div className="portal-header-account" ref={accountRef}>
          <button
            className="portal-header-account-trigger"
            type="button"
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((current) => !current)}
          >
            <span className="portal-header-account-avatar" aria-hidden="true">{getAccountInitials(userProfile.name, userProfile.email)}</span>
            <span className="portal-header-account-name">{userProfile.name}</span>
          </button>
          {accountOpen && <div className="portal-header-account-menu">
            <span>{userProfile.name}</span>
            <small>{userProfile.email}</small>
            <button className="portal-signout" type="button" onClick={() => void logout()} disabled={isLoading}>Sign out</button>
          </div>}
        </div>}
      </header>
      {children}
    </section>
  </main>;
}
