"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { ROUTES } from "@/config/routes";
import { countDocuments } from "@/services/firestore/firestoreService";
import { COLLECTIONS } from "@/constants/firestore";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ConsumerHome() {
  const { firebaseUser, userProfile } = useAuth();
  const [bookingCount, setBookingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    void countDocuments(COLLECTIONS.bookings, [
      { field: "consumerId", operator: "==", value: firebaseUser.uid },
    ]).then(setBookingCount).catch(() => setBookingCount(0));
  }, [firebaseUser]);

  const firstName = userProfile?.name?.split(" ")[0] ?? "";

  return <div className="portal-consumer-focus">
    <header className="portal-consumer-focus-header">
      <Link href="/" className="portal-wordmark" aria-label="Return to Ayursarga home">
        <Image src="/mainlogo.png" alt="" width={40} height={40} loading="eager" quality={90} sizes="40px" />
        <span>Ayursarga</span>
      </Link>
      <div className="portal-consumer-focus-title">
        <span>My Ayursarga</span>
        <h1>Home</h1>
      </div>
    </header>
    <div className="portal-consumer-home">
      <div className="portal-consumer-home-hero">
        <span className="portal-welcome-eyebrow">My Ayursarga</span>
        <h1>{getGreeting()}{firstName ? `, ${firstName}` : ""}</h1>
        <p>Your personal wellness hub. Browse Ayurveda healing centres, manage your appointment requests, and follow your care journey.</p>
        {bookingCount !== null && bookingCount > 0 && <div className="portal-consumer-home-stat">
          <strong>{bookingCount}</strong>
          <span>appointment{bookingCount !== 1 ? "s" : ""} on record</span>
        </div>}
      </div>
      <nav className="portal-consumer-home-actions" aria-label="Quick actions">
        <Link className="portal-consumer-home-card" href={ROUTES.public.centers}>
          <span className="portal-consumer-home-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></svg>
          </span>
          Browse healing centres
        </Link>
        <Link className="portal-consumer-home-card" href={ROUTES.consumer.bookings}>
          <span className="portal-consumer-home-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>
          </span>
          View my bookings
        </Link>
      </nav>
    </div>
  </div>;
}

export default function ConsumerHomePage() {
  return <RequireRole role="consumer"><ConsumerHome /></RequireRole>;
}
