"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ROUTES } from "@/config/routes";
import type { PortalRole } from "@/features/auth/contracts";

const LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "/app", label: "Find Hospitals" },
  { href: "#wellness", label: "Wellness" },
  { href: "#why-ayursarga", label: "Why Ayursarga" },
  { href: "#partners", label: "For Hospitals" },
];

const ACCOUNT_DESTINATIONS = {
  consumer: { href: ROUTES.consumer.home, label: "My Account" },
  hospital: { href: ROUTES.hospital.home, label: "Hospital Portal" },
  admin: { href: ROUTES.admin.home, label: "Admin Portal" },
} as const satisfies Record<PortalRole, { href: string; label: string }>;

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountRole, setAccountRole] = useState<PortalRole | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import("@/services/auth/authService").then(({ authService }) => {
      if (!active) return;
      unsubscribe = authService.subscribe((snapshot) => {
        if (!active) return;
        setAccountRole(snapshot.profile?.status === "active" ? snapshot.profile.role : null);
        setAuthReady(true);
      }, () => {
        if (!active) return;
        setAccountRole(null);
        setAuthReady(true);
      });
    }).catch(() => {
      if (active) setAuthReady(true);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 80);
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <header id="site-nav" className={scrolled ? "scrolled" : ""}>
        <div className="nav-inner">
          <a href="#hero" className="nav-mark">
            <Image src="/mainlogo.png" alt="Ayursarga" width={56} height={56} loading="eager" quality={90} sizes="56px" />
            <span>Ayursarga</span>
          </a>
          <nav className="nav-links">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          {!authReady ? <div className="nav-account-placeholder" aria-hidden="true" /> : accountRole ?
            <a className="nav-portal-link" href={ACCOUNT_DESTINATIONS[accountRole].href}>{ACCOUNT_DESTINATIONS[accountRole].label}</a> :
            <div className="nav-account-actions">
              <a className="nav-register" href={ROUTES.consumer.register}>Register</a>
              <details className="nav-login">
                <summary>Login</summary>
                <div className="nav-login-menu">
                  <a href={ROUTES.consumer.login}><span>Consumer</span><small>Discover and book care</small></a>
                  <a href={ROUTES.hospital.login}><span>Hospital</span><small>Manage services and bookings</small></a>
                  <a href={ROUTES.admin.login}><span>Admin</span><small>Platform administration</small></a>
                </div>
              </details>
            </div>}
          <button
            id="nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className={open ? "open" : ""}
            onClick={() => setOpen((o) => !o)}
          >
            <span style={open ? { transform: "translateY(8px) rotate(45deg)" } : undefined} />
            <span style={open ? { opacity: 0 } : undefined} />
            <span style={open ? { transform: "translateY(-8px) rotate(-45deg)" } : undefined} />
          </button>
        </div>
      </header>

      <div id="mobile-menu" className={open ? "open" : ""}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        {authReady && accountRole ?
          <a className="mobile-account-link" href={ACCOUNT_DESTINATIONS[accountRole].href} onClick={() => setOpen(false)}>{ACCOUNT_DESTINATIONS[accountRole].label}</a> : authReady ? <>
            <a className="mobile-register-link" href={ROUTES.consumer.register} onClick={() => setOpen(false)}>Register</a>
            <div className="mobile-login-group">
              <span>Login</span>
              <a href={ROUTES.consumer.login} onClick={() => setOpen(false)}>Consumer</a>
              <a href={ROUTES.hospital.login} onClick={() => setOpen(false)}>Hospital</a>
              <a href={ROUTES.admin.login} onClick={() => setOpen(false)}>Admin</a>
            </div>
          </> : <div className="mobile-auth-placeholder" aria-hidden="true" />}
      </div>
    </>
  );
}
