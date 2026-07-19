"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import MagneticButton from "./MagneticButton";

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
          <a href="#hero" className="nav-mark" data-hover>
            <Image src="/mainlogo.png" alt="Ayursarga" width={38} height={38} />
            <span>Ayursarga</span>
          </a>
          <nav className="nav-links">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} data-hover>
                {l.label}
              </a>
            ))}
          </nav>
          <MagneticButton href="#contact" className="btn-magnetic nav-cta btn-primary">
            Book a Consultation
          </MagneticButton>
          <button
            id="nav-burger"
            aria-label="Menu"
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
        <a href="#contact" onClick={() => setOpen(false)}>
          Book a Consultation
        </a>
      </div>
    </>
  );
}
