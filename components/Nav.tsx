"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
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

type MobileNavIconName = "home" | "discover" | "search" | "contact" | "account";

function MobileNavIcon({ name }: { name: MobileNavIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "home" && <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>}
    {name === "discover" && <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></>}
    {name === "search" && <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m15.8 15.8 4.2 4.2" /></>}
    {name === "contact" && <><path d="M7.2 3.5 10 8.2 7.9 10a15.5 15.5 0 0 0 6.1 6.1l1.8-2.1 4.7 2.8-.8 3.1c-.2.7-.8 1.1-1.5 1.1C10.1 20.6 3.4 13.9 3 5.8c0-.7.4-1.3 1.1-1.5l3.1-.8Z" /></>}
    {name === "account" && <><circle cx="12" cy="7" r="3.2" /><path d="M5 21v-1a7 7 0 0 1 14 0v1" /></>}
  </svg>;
}

function GoogleMark() {
  return <svg className="nav-google-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 5.9Z" />
  </svg>;
}

function PublicNav({ sectionPrefix = "", solid = false }: NavProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileAccountRef = useRef<HTMLDivElement>(null);
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
    const locked = loginOpen;
    document.documentElement.classList.toggle("nav-overlay-open", locked);
    window.dispatchEvent(new CustomEvent("ayursarga:scroll-lock", { detail: locked }));
    return () => {
      document.documentElement.classList.remove("nav-overlay-open");
      window.dispatchEvent(new CustomEvent("ayursarga:scroll-lock", { detail: false }));
    };
  }, [loginOpen]);

  useEffect(() => {
    if (loginOpen) dialogRef.current?.querySelector<HTMLButtonElement>(".nav-auth-option")?.focus();
  }, [loginOpen]);

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      if (profileOpen && event.target instanceof Node && !accountRef.current?.contains(event.target) && !mobileAccountRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
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
            <button type="button" className="nav-profile-trigger" aria-label="Open your Ayursarga account" aria-expanded={profileOpen} onClick={() => setProfileOpen((current) => !current)}>
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

      </div>
    </header>

    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <a href={sectionPrefix ? ROUTES.public.home : "#hero"} aria-current={pathname === ROUTES.public.home ? "page" : undefined}><MobileNavIcon name="home" /><span>Home</span></a>
      <a href={linkHref("#discover-hospitals")}><MobileNavIcon name="discover" /><span>Discover</span></a>
      <a className="mobile-bottom-search" href={ROUTES.public.centers} aria-current={pathname === ROUTES.public.centers ? "page" : undefined}><span className="mobile-bottom-search-icon"><MobileNavIcon name="search" /></span><span>Search</span></a>
      <a href={ROUTES.public.contact} aria-current={pathname === ROUTES.public.contact ? "page" : undefined}><MobileNavIcon name="contact" /><span>Contact</span></a>
      <div ref={mobileAccountRef} className="mobile-bottom-account">
        {consumerSignedIn ? <button type="button" aria-label="Open your Ayursarga account" aria-expanded={profileOpen} onClick={() => setProfileOpen((current) => !current)}>
          <Image className="mobile-bottom-avatar" src={avatarUrl || "/mainlogo.png"} alt="" width={28} height={28} sizes="28px" unoptimized={Boolean(avatarUrl)} referrerPolicy="no-referrer" />
          <span>Profile</span>
        </button> : <button type="button" onClick={openLogin}><MobileNavIcon name="account" /><span>Login</span></button>}
        {consumerSignedIn && profileOpen && <div className="nav-profile-menu mobile-profile-menu">
          <div className="nav-profile-details">
            <span className="nav-profile-name">{userProfile?.name || firebaseUser?.displayName || "Ayursarga consumer"}</span>
            <span className="nav-profile-email">{userProfile?.email || firebaseUser?.email}</span>
          </div>
          <div className="nav-profile-actions">
            <a href={ROUTES.consumer.bookings} onClick={() => setProfileOpen(false)}>My bookings</a>
            <button type="button" onClick={() => void signOutConsumer()} disabled={isLoading}>Logout</button>
          </div>
        </div>}
      </div>
    </nav>

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
            <span className="nav-auth-option-icon hospital" aria-hidden="true"><Image className="nav-hospital-partner-image" src="/hospital-partner.png" alt="" width={44} height={44} sizes="44px" /></span>
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
