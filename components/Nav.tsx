"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/config/routes";
import ScrollLogo from "@/components/ScrollLogo";

const LINKS = [
  { href: "#discover-hospitals", label: "How It Works" },
  { href: ROUTES.public.centers, label: "Search Hospitals" },
  { href: "#why-ayursarga", label: "Why Ayursarga" },
  { href: "#partners", label: "For Hospitals" },
];

type NavProps = { sectionPrefix?: string; solid?: boolean };

function GoogleMark() {
  return <svg className="nav-google-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 5.9Z" />
  </svg>;
}

function PublicNav({ sectionPrefix = "", solid = false }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { firebaseUser, userProfile, role, isLoading, error, clearError, loginConsumerWithGoogle, logout } = useAuth();
  const consumerSignedIn = role === "consumer" && Boolean(firebaseUser && userProfile);
  const linkHref = (href: string) => href.startsWith("#") ? `${sectionPrefix}${href}` : href;

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
    const locked = open || loginOpen;
    document.documentElement.classList.toggle("nav-overlay-open", locked);
    window.dispatchEvent(new CustomEvent("ayursarga:scroll-lock", { detail: locked }));
    return () => {
      document.documentElement.classList.remove("nav-overlay-open");
      window.dispatchEvent(new CustomEvent("ayursarga:scroll-lock", { detail: false }));
    };
  }, [loginOpen, open]);

  useEffect(() => {
    if (loginOpen) dialogRef.current?.querySelector<HTMLButtonElement>(".nav-auth-option")?.focus();
  }, [loginOpen]);

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      if (profileOpen && event.target instanceof Node && !accountRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setLoginOpen(false);
      setProfileOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  async function continueWithGoogle() {
    clearError();
    try {
      await loginConsumerWithGoogle(null, true);
      setLoginOpen(false);
    } catch {
      // The shared authentication context exposes the friendly error below.
    }
  }

  async function signOutConsumer() {
    setProfileOpen(false);
    await logout().catch(() => undefined);
  }

  const openLogin = () => {
    clearError();
    setOpen(false);
    setProfileOpen(false);
    setLoginOpen(true);
  };
  const avatarUrl = firebaseUser?.photoURL ?? null;

  return <>
    <ScrollLogo />
    <header id="site-nav" className={scrolled || solid ? "scrolled" : ""}>
      <div className="nav-inner">
        <a href={sectionPrefix ? "/" : "#hero"} className="nav-mark">
          <Image src="/mainlogo.png" alt="Ayursarga" width={56} height={56} priority loading="eager" quality={90} sizes="56px" />
          <span>Ayursarga</span>
        </a>
        <nav className="nav-links">
          {LINKS.map((link) => <a key={link.href} href={linkHref(link.href)}>{link.label}</a>)}
        </nav>

        <div ref={accountRef} className={`nav-account-actions${consumerSignedIn ? " has-consumer" : ""}`}>
          {consumerSignedIn ? <div className="nav-profile">
            <button type="button" className="nav-profile-trigger" aria-label="Open your Ayursarga account" aria-expanded={profileOpen} onClick={() => { setOpen(false); setProfileOpen((current) => !current); }}>
              <Image className="nav-profile-avatar-image" src={avatarUrl || "/mainlogo.png"} alt="" width={42} height={42} sizes="42px" unoptimized={Boolean(avatarUrl)} referrerPolicy="no-referrer" />
            </button>
            {profileOpen && <div className="nav-profile-menu">
              <div className="nav-profile-details">
                <span className="nav-profile-name">{userProfile?.name || firebaseUser?.displayName || "Ayursarga consumer"}</span>
                <span className="nav-profile-email">{userProfile?.email || firebaseUser?.email}</span>
              </div>
              <div className="nav-profile-actions">
                <a href={ROUTES.consumer.bookings} onClick={() => setProfileOpen(false)}>My bookings</a>
                <button type="button" onClick={() => void signOutConsumer()} disabled={isLoading}>Logout</button>
              </div>
            </div>}
          </div> : <button type="button" className="nav-login-button" onClick={openLogin}>Login</button>}
        </div>

        <button id="nav-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" className={open ? "open" : ""} onClick={() => { setProfileOpen(false); setOpen((current) => !current); }}>
          <span style={open ? { transform: "translateY(8px) rotate(45deg)" } : undefined} />
          <span style={open ? { opacity: 0 } : undefined} />
          <span style={open ? { transform: "translateY(-8px) rotate(-45deg)" } : undefined} />
        </button>
      </div>
    </header>

    <div id="mobile-menu" className={open ? "open" : ""}>
      {LINKS.map((link) => <a key={link.href} href={linkHref(link.href)} onClick={() => setOpen(false)}>{link.label}</a>)}
      {!consumerSignedIn && <button type="button" className="mobile-login-action" onClick={openLogin}>Login</button>}
    </div>

    {loginOpen && <div className="nav-auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
      <div ref={dialogRef} className="nav-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="nav-auth-title">
        <button type="button" className="nav-auth-close" aria-label="Close login options" onClick={() => setLoginOpen(false)}>×</button>
        <span className="eyebrow">Ayursarga access</span>
        <h2 id="nav-auth-title">How would you like to continue?</h2>
        <div className="nav-auth-options">
          <button type="button" className="nav-auth-option" onClick={() => void continueWithGoogle()} disabled={isLoading}>
            <span className="nav-auth-option-icon"><GoogleMark /></span>
            <span><strong>I&apos;m looking for care</strong><small>{isLoading ? "Connecting securely..." : "Continue with Google Sign-In"}</small></span>
          </button>
          <a className="nav-auth-option" href={ROUTES.hospital.login}>
            <span className="nav-auth-option-icon hospital" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21h16M6 21V5h12v16M9 9h6m-3-3v6M9 15h2m2 0h2m-4 6v-3h2v3" /></svg></span>
            <span><strong>I&apos;m a hospital partner</strong><small>Continue to Hospital Login</small></span>
          </a>
        </div>
        {error && <p className="nav-auth-error" role="alert">{error.message}</p>}
      </div>
    </div>}
  </>;
}

export default function Nav(props: NavProps) {
  return <AuthProvider><PublicNav {...props} /></AuthProvider>;
}
