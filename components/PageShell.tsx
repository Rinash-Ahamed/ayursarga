"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import SmoothScroll from "@/components/SmoothScroll";
import ScrollLogo from "@/components/ScrollLogo";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import ScrollLife from "@/components/ScrollLife";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import Journey from "@/components/Journey";
import Therapies from "@/components/Therapies";
import Sanctuary from "@/components/Sanctuary";
import Voices from "@/components/Voices";
import Contact from "@/components/Contact";
import GeneralQuestions from "@/components/GeneralQuestions";
import Footer from "@/components/Footer";
import type { GuidanceProfile } from "@/lib/guidanceProfile";

// Particle field uses browser animation APIs - load client-only, no SSR.
const ParticleField = dynamic(() => import("@/components/ParticleField"), { ssr: false });

export default function PageShell() {
  const [guidanceProfile, setGuidanceProfile] = useState<GuidanceProfile | null>(null);

  return (
    <>
      <ParticleField />
      <ScrollLogo />
      <WhatsAppBubble />
      <ScrollLife />
      <Nav />

      <SmoothScroll>
        <main>
          <Hero />
          <Philosophy />
          <Journey onComplete={setGuidanceProfile} />
          <Therapies />
          <Sanctuary />
          <Voices />
          <Contact guidanceProfile={guidanceProfile} />
          <GeneralQuestions />
        </main>
        <Footer />
      </SmoothScroll>
    </>
  );
}
