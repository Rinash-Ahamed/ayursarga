"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import SmoothScroll from "@/components/SmoothScroll";
import Preloader from "@/components/Preloader";
import CustomCursor from "@/components/CustomCursor";
import ProgressFlame from "@/components/ProgressFlame";
import ScrollLife from "@/components/ScrollLife";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import Journey from "@/components/Journey";
import Therapies from "@/components/Therapies";
import Sanctuary from "@/components/Sanctuary";
import Voices from "@/components/Voices";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import BotanicalTransition from "@/components/BotanicalTransition";

// Particle field uses browser animation APIs - load client-only, no SSR.
const ParticleField = dynamic(() => import("@/components/ParticleField"), { ssr: false });

export default function PageShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.remove("loading");
  }, [ready]);

  return (
    <>
      <Preloader onDone={() => setReady(true)} />
      <div className="grain-overlay" />
      <ParticleField />
      <ProgressFlame />
      <ScrollLife />
      <CustomCursor />
      <Nav />

      <SmoothScroll>
        <main>
          <Hero ready={ready} />
          <Philosophy />
          <BotanicalTransition tone="cream-to-forest" />
          <Journey />
          <BotanicalTransition tone="forest-to-cream" reverse />
          <Therapies />
          <BotanicalTransition tone="cream-to-forest" />
          <Sanctuary />
          <BotanicalTransition tone="forest-to-cream" reverse />
          <Voices />
          <BotanicalTransition tone="cream" />
          <Contact />
        </main>
        <Footer />
      </SmoothScroll>
    </>
  );
}
