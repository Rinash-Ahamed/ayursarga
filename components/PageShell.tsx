"use client";

import dynamic from "next/dynamic";
import SmoothScroll from "@/components/SmoothScroll";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import WellnessGuide from "@/components/WellnessGuide";
import Therapies from "@/components/Therapies";
import Sanctuary from "@/components/Sanctuary";
import Voices from "@/components/Voices";
import GeneralQuestions from "@/components/GeneralQuestions";
import Footer from "@/components/Footer";
import { useBrowserIdle } from "@/hooks/useBrowserIdle";

// Nonessential ambient effects begin only after initial content has painted.
const ParticleField = dynamic(() => import("@/components/ParticleField"), { ssr: false });
const ScrollLogo = dynamic(() => import("@/components/ScrollLogo"), { ssr: false });

export default function PageShell() {
  const ambientEffectsReady = useBrowserIdle(1_500);

  return (
    <>
      {ambientEffectsReady && <ParticleField />}
      {ambientEffectsReady && <ScrollLogo />}
      <WhatsAppBubble />
      <Nav />

      <SmoothScroll>
        <main>
          <Hero />
          <WellnessGuide />
          <Philosophy />
          <Therapies />
          <Sanctuary />
          <Voices />
          <GeneralQuestions />
        </main>
        <Footer />
      </SmoothScroll>
    </>
  );
}
