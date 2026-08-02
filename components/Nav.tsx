"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ROUTES } from "@/config/routes";

const LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#matching", label: "Find Care" },
  { href: "#wellness", label: "Wellness" },
  { href: "#why-ayursarga", label: "Why Ayursarga" },
  { href: "#partners", label: "For Partners" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          <details className="nav-login">
            <summary>Login</summary>
            <div className="nav-login-menu">
              <a href={ROUTES.consumer.login}><span>Consumer</span><small>Discover and book care</small></a>
              <a href={ROUTES.hospital.login}><span>Hospital</span><small>Manage services and bookings</small></a>
              <a href={ROUTES.admin.login}><span>Admin</span><small>Platform administration</small></a>
            </div>
          </details>
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
        <div className="mobile-login-group">
          <span>Login</span>
          <a href={ROUTES.consumer.login} onClick={() => setOpen(false)}>Consumer</a>
          <a href={ROUTES.hospital.login} onClick={() => setOpen(false)}>Hospital</a>
          <a href={ROUTES.admin.login} onClick={() => setOpen(false)}>Admin</a>
        </div>
      </div>
    </>
  );
}
