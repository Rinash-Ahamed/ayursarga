"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import { PortalNotifications } from "@/components/portal/PortalNotifications";

type PortalNavigationIcon = "dashboard" | "hospitals" | "consultants" | "users" | "bookings" | "availability" | "audit" | "profile" | "services" | "password";
type NavigationItem = readonly [label: string, href: string, icon: PortalNavigationIcon, nested?: boolean];
const SIDEBAR_STORAGE_KEY = "ayursarga-portal-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "ayursarga-sidebar-change";
let sidebarStorageFallback = false;

function getSidebarCollapsedSnapshot() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return sidebarStorageFallback;
  }
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

const NAVIGATION: Record<PortalRole, readonly NavigationItem[]> = {
  admin: [
    ["Dashboard", ROUTES.admin.home, "dashboard"], ["Hospitals", ROUTES.admin.hospitals, "hospitals"],
    ["Our Consultants", ROUTES.admin.consultants, "consultants", true],
    ["Users", ROUTES.admin.users, "users"], ["Bookings", ROUTES.admin.bookings, "bookings"],
    ["Availability", ROUTES.admin.availability, "availability"],
    ["Audit Logs", ROUTES.admin.audits, "audit"],
  ],
  hospital: [
    ["Dashboard", ROUTES.hospital.home, "dashboard"], ["Hospital Profile", ROUTES.hospital.profile, "profile"],
    ["Services", ROUTES.hospital.services, "services"], ["Bookings", ROUTES.hospital.bookings, "bookings"],
    ["Availability", ROUTES.hospital.availability, "availability"],
    ["Change Password", ROUTES.hospital.changePassword, "password"],
  ],
  consumer: [],
};

function PortalNavigationIcon({ name }: { name: PortalNavigationIcon }) {
  const paths: Record<PortalNavigationIcon, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    hospitals: <><path d="M4 21V6h16v15M8 6V3h8v3M3 21h18M9 10h6M12 7v6M8 17h2m4 0h2" /></>,
    consultants: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-2.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20M17 7v6m-3-3h6" /></>,
    users: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20v-2.2A4.8 4.8 0 0 1 7.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20M14 14.2a4.4 4.4 0 0 1 7.5 3.1V20" /></>,
    bookings: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m2 0h3m-8 3h3" /></>,
    availability: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M7 3l-2 2m12-2 2 2" /></>,
    audit: <><path d="M7 3h10v4H7zM5 5H3v16h18V5h-2M8 12h8m-8 4h5" /><path d="m16 17 1.5 1.5L21 15" /></>,
    profile: <><path d="M4 21V6h16v15M8 6V3h8v3M3 21h18M9 10h6M12 7v6" /><circle cx="12" cy="17" r="2" /></>,
    services: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,
    password: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  };
  return <svg className="portal-nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function getAccountInitials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
  return (words[0]?.slice(0, 2) || email.slice(0, 2) || "AS").toUpperCase();
}

function isNavigationActive(pathname: string, href: string) {
  if (pathname === href) return true;
  const isPortalHome = href === ROUTES.admin.home || href === ROUTES.hospital.home;
  return !isPortalHome && pathname.startsWith(`${href}/`);
}

export function PortalShell({ role, title, children, focused = false }: {
  role: PortalRole; title: string; children: ReactNode; focused?: boolean;
}) {
  const pathname = usePathname();
  const { userProfile, logout, isLoading } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarCollapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarCollapsedSnapshot, () => false);
  const accountRef = useRef<HTMLDivElement>(null);

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    sidebarStorageFallback = next;
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // The in-memory fallback keeps this page responsive when storage is unavailable.
    }
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  }
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
      <section className="portal-consumer-focus-content">
        <div className="portal-page-enter" key={pathname}>{children}</div>
      </section>
    </main>;
  }

  return <main className="portal-workspace" data-sidebar-collapsed={sidebarCollapsed || undefined}>
    <aside className="portal-sidebar" data-role={role} data-mobile-open={mobileMenuOpen || undefined} data-collapsed={sidebarCollapsed || undefined}>
      <div className="portal-sidebar-top">
        <Link href="/" className="portal-wordmark" aria-label="Return to Ayursarga home">
          <Image src="/mainlogo.png" alt="" width={44} height={44} loading="eager" quality={90} sizes="44px" />
          <span>Ayursarga</span>
        </Link>
        <button className="portal-sidebar-collapse" type="button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} aria-controls="portal-sidebar-navigation" onClick={toggleSidebar}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <button className="portal-mobile-menu-toggle" type="button" aria-label="Open portal menu" aria-expanded={mobileMenuOpen} aria-controls="portal-mobile-drawer" onClick={() => setMobileMenuOpen(true)}>
          <span /><span /><span />
        </button>
      </div>
      <div className="portal-sidebar-drawer" id="portal-mobile-drawer">
        <div className="portal-mobile-drawer-heading">
          <span>Menu</span>
          <button type="button" aria-label="Close portal menu" onClick={() => setMobileMenuOpen(false)}>×</button>
        </div>
        <nav id="portal-sidebar-navigation" aria-label={`${role} navigation`}>
          {NAVIGATION[role].map(([label, href, icon, nested]) =>
            <Link className={nested ? "portal-nav-subitem" : undefined} key={href} href={href} aria-label={sidebarCollapsed ? label : undefined} title={sidebarCollapsed ? label : undefined} aria-current={isNavigationActive(pathname, href) ? "page" : undefined} onClick={() => { setAccountOpen(false); setMobileMenuOpen(false); }}>
              <PortalNavigationIcon name={icon} /><span className="portal-nav-label">{label}</span>
            </Link>)}
        </nav>
        {userProfile && role !== "consumer" && <div className="portal-mobile-account">
          <span className="portal-header-account-avatar" aria-hidden="true">{getAccountInitials(userProfile.name, userProfile.email)}</span>
          <div><strong>{userProfile.name}</strong><small>{userProfile.email}</small></div>
          <button className="portal-signout" type="button" onClick={() => { setMobileMenuOpen(false); void logout(); }} disabled={isLoading}>Sign out</button>
        </div>}
        <div className="portal-sidebar-footer">
          <small className="portal-version"><span className="portal-version-brand">Ayursarga </span>v{process.env.NEXT_PUBLIC_APP_VERSION}</small>
        </div>
      </div>
    </aside>
    {mobileMenuOpen && <button className="portal-mobile-menu-backdrop" type="button" aria-label="Close portal menu" onClick={() => setMobileMenuOpen(false)} />}
    <section className="portal-content">
      <header className="portal-page-header">
        <div className="portal-page-heading">
          <h1>{title}</h1>
        </div>
        {userProfile && role !== "consumer" && <div className="portal-header-tools">
          <PortalNotifications recipientId={userProfile.uid} />
          <div className="portal-header-account" ref={accountRef}>
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
          </div>
        </div>}
      </header>
      <div className="portal-page-enter" key={pathname}>
        {children}
      </div>
    </section>
  </main>;
}
