"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import { PortalNotifications } from "@/components/portal/PortalNotifications";
import { lockDocumentScroll } from "@/utils/documentScrollLock";
import { ConsumerPortalFooter } from "@/components/consumer/ConsumerPortalFooter";
import AyuBuddy from "@/components/AyuBuddy";

type PortalNavigationIcon = "dashboard" | "hospitals" | "consultants" | "users" | "bookings" | "availability" | "audit" | "profile" | "services" | "password" | "search" | "person" | "support" | "billing" | "settings";
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
    ["Invoices & Billing", ROUTES.admin.billing, "billing"],
    ["Audit Logs", ROUTES.admin.audits, "audit"],
    ["Settings", ROUTES.admin.settings, "settings"],
  ],
  hospital: [
    ["Dashboard", ROUTES.hospital.home, "dashboard"], ["Hospital Profile", ROUTES.hospital.profile, "profile"],
    ["Services", ROUTES.hospital.services, "services"], ["Bookings", ROUTES.hospital.bookings, "bookings"],
    ["Availability", ROUTES.hospital.availability, "availability"],
    ["Change Password", ROUTES.hospital.changePassword, "password"],
  ],
  consumer: [
    ["My bookings", ROUTES.consumer.bookings, "bookings"],
    ["Search hospitals", ROUTES.public.centers, "search"],
    ["My profile", ROUTES.consumer.profile, "person"],
    ["Help & support", ROUTES.consumer.support, "support"],
  ],
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
    billing: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
    profile: <><path d="M4 21V6h16v15M8 6V3h8v3M3 21h18M9 10h6M12 7v6" /><circle cx="12" cy="17" r="2" /></>,
    services: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,
    password: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    settings: <><path d="m10 3-.5 2a7 7 0 0 0-2 1.2l-2-.6-2 3.4L5 10.5a7 7 0 0 0 0 3l-1.5 1.5 2 3.4 2-.6a7 7 0 0 0 2 1.2l.5 2h4l.5-2a7 7 0 0 0 2-1.2l2 .6 2-3.4-1.5-1.5a7 7 0 0 0 0-3L20.5 9l-2-3.4-2 .6a7 7 0 0 0-2-1.2L14 3Z" /><circle cx="12" cy="12" r="3" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    support: <><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 12H3v6h4v-6zm16 0h1v6h-4v-6zM18 18v1a2 2 0 0 1-2 2h-4" /></>,
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
  const { firebaseUser, userProfile, logout, isLoading } = useAuth();
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const consumerAvatar = role === "consumer" && firebaseUser?.photoURL && firebaseUser.photoURL !== failedAvatar ? firebaseUser.photoURL : null;
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarCollapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarCollapsedSnapshot, () => false);
  const accountRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (role === "consumer" && focused) return;
    let frame = 0;
    const updateToastPosition = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
        const sidebarBottom = window.innerWidth <= 760 ? document.querySelector(".portal-sidebar")?.getBoundingClientRect().bottom ?? 0 : 0;
        document.documentElement.style.setProperty("--portal-toast-top", `${Math.max(16, headerBottom + 12, sidebarBottom + 12)}px`);
      });
    };
    const observer = new ResizeObserver(updateToastPosition);
    if (headerRef.current) observer.observe(headerRef.current);
    window.addEventListener("scroll", updateToastPosition, { passive: true });
    window.addEventListener("resize", updateToastPosition);
    updateToastPosition();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateToastPosition);
      window.removeEventListener("resize", updateToastPosition);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--portal-toast-top");
    };
  }, [pathname, role, focused]);

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
    const unlock = lockDocumentScroll();
    const drawer = document.getElementById("portal-mobile-drawer");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') ?? [])
      .filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus({ preventScroll: true });
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (document.querySelector(".app-modal-layer")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (first && last && (!drawer?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.classList.remove("portal-menu-open");
      document.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", closeOnDesktop);
      unlock();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
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
        <ConsumerPortalFooter />
      </section>
    </main>;
  }

  return <main className={`portal-workspace${role === "consumer" ? " portal-consumer-workspace" : ""}`} data-sidebar-collapsed={sidebarCollapsed || undefined}>
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
      <div className="portal-sidebar-drawer" id="portal-mobile-drawer" role={mobileMenuOpen ? "dialog" : undefined} aria-modal={mobileMenuOpen || undefined} aria-label={mobileMenuOpen ? "Portal menu" : undefined}>
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
      <header className="portal-page-header" ref={headerRef}>
        {role === "consumer" && <Link className="consumer-mobile-brand" href={ROUTES.public.home} aria-label="Return to Ayursarga home"><Image src="/mainlogo.png" alt="" width={30} height={30} sizes="30px" /><span>Ayursarga</span></Link>}
        <div className="portal-page-heading">
          <h1>{title}</h1>
        </div>
        {userProfile && <div className="portal-header-tools">
          {role !== "consumer" && <PortalNotifications key={userProfile.uid} recipientId={userProfile.uid} />}
          <div className="portal-header-account" ref={accountRef}>
          <button
            className="portal-header-account-trigger"
            type="button"
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((current) => !current)}
          >
            <span className="portal-header-account-avatar" aria-hidden="true">{consumerAvatar ? <Image className="consumer-account-photo" src={consumerAvatar} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" onError={() => setFailedAvatar(consumerAvatar)} /> : getAccountInitials(userProfile.name, userProfile.email)}</span>
            <span className="portal-header-account-name">{userProfile.name}</span>
          </button>
          {accountOpen && <div className="portal-header-account-menu">
            <span>{userProfile.name}</span>
            <small>{userProfile.email}</small>
            {role === "consumer" && <Link className="consumer-account-profile" href={ROUTES.consumer.profile} onClick={() => setAccountOpen(false)}>My profile</Link>}
            <button className="portal-signout" type="button" onClick={() => void logout()} disabled={isLoading}>{role === "consumer" ? "Logout" : "Sign out"}</button>
          </div>}
          </div>
        </div>}
      </header>
      <div className={`portal-page-enter${role === "consumer" ? " consumer-content-body" : ""}`} key={pathname}>
        {children}
      </div>
      {role === "consumer" && <ConsumerPortalFooter />}
    </section>
    {role === "consumer" && <AyuBuddy />}
    {role === "consumer" && <nav className="consumer-bottom-nav" aria-label="Consumer mobile navigation">
      {NAVIGATION.consumer.map(([label, href, icon], index) => <Link key={href} href={href} aria-label={label} aria-current={isNavigationActive(pathname, href) ? "page" : undefined}><PortalNavigationIcon name={icon} /><span>{["Bookings", "Search", "Profile", "Help"][index]}</span></Link>)}
    </nav>}
  </main>;
}
