"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasPublicHospitalForService } from "@/services/hospitals/publicHospitalService";
import { RevealLines, RevealWords } from "./Reveal";
import TreatmentFilm from "./TreatmentFilm";

const PATHS = [
  ["Postnatal recovery", "Restorative care for the mother after birth, with support options for baby and family.", "/Postnatal Recovery.jpeg"],
  ["Panchakarma", "Doctor-guided cleansing and renewal programmes tailored to your constitution.", "/Panchakarma.jpeg"],
  ["Stress management", "Quiet stays, therapies and practices designed to settle an overextended system.", "/Stress Managemen.jpeg"],
  ["Weight management", "Sustainable Ayurvedic programmes built around food, movement and metabolic health.", "/WT Management.jpeg"],
  ["PCOS care", "Holistic support for hormonal balance, daily rhythm and long-term wellbeing.", "/PCOS Care.jpeg"],
  ["Women’s wellness", "Personalised care through changing seasons of a woman’s health.", "/Womesn Wellness.jpeg"],
  ["Corporate wellness", "Restorative programmes for teams, leaders and high-pressure work cultures.", "/Corperate Wellness.jpeg"],
  ["Couples retreat", "Shared time to slow down, reconnect and return home with healthier rhythms.", "/Couplea Retreat.jpeg"],
  ["Detox retreat", "A considered reset through therapeutic care, nourishing food and genuine rest.", "/Detox Retreat.jpeg"],
] as const;

export default function Therapies() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const sliderRef = useRef<HTMLDivElement>(null);
  const messageTimerRef = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [busyService, setBusyService] = useState<string | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  const moveSlider = useCallback((direction: -1 | 1) => {
    const slider = sliderRef.current;
    const card = slider?.querySelector<HTMLElement>(".path-card");
    if (!slider || !card) return;

    const gap = Number.parseFloat(window.getComputedStyle(slider).columnGap) || 16;
    const step = card.offsetWidth + gap;
    const reachedEnd = slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - step / 2;
    const reachedStart = slider.scrollLeft <= step / 2;
    const nextLeft = direction === 1 && reachedEnd
      ? 0
      : direction === -1 && reachedStart
        ? slider.scrollWidth
        : slider.scrollLeft + direction * step;
    slider.scrollTo({ left: nextLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused || busyService) return;
    const interval = window.setInterval(() => moveSlider(1), 6000);
    return () => window.clearInterval(interval);
  }, [busyService, isPaused, moveSlider, prefersReducedMotion]);

  useEffect(() => () => {
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
  }, []);

  function showAvailabilityMessage(message: string) {
    setAvailabilityMessage(message);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => setAvailabilityMessage(null), 5000);
  }

  async function openService(serviceName: string) {
    if (busyService) return;
    setBusyService(serviceName);
    setAvailabilityMessage(null);
    try {
      if (await hasPublicHospitalForService(serviceName)) {
        router.push(`/centers?service=${encodeURIComponent(serviceName)}`);
        return;
      }
      showAvailabilityMessage(`No active Ayursarga center currently lists ${serviceName}. Try another wellness path or ask us for guidance.`);
    } catch {
      showAvailabilityMessage("We could not check center availability right now. Please try again in a moment.");
    } finally {
      setBusyService(null);
    }
  }

  return <section id="wellness" className="section"><div className="section-inner">
    <RevealWords text="Wellness Paths" className="eyebrow" />
    <RevealLines as="h2" className="section-title" lines={["Care for where", "you are now."]} />
    <p className="section-intro">From maternal care to deep rejuvenation, explore programmes selected around your goals - not a generic package list.</p>
    <TreatmentFilm />
    <motion.div id="family-wellness" className="family-story" initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }}>
      <Image src="/mother-child-garden.png" alt="Mother and child exploring medicinal leaves in a Kerala retreat garden" width={1152} height={1440} sizes="(max-width: 900px) 100vw, 42vw" quality={82} />
      <div><span className="eyebrow">Mother &amp; Child</span><h3>Wellness that holds the whole family.</h3><p>From prenatal preparation to postnatal recovery, baby care and lactation support, explore active services from Ayursarga hospital partners.</p></div>
    </motion.div>
    <div className="path-slider-heading">
      <span>Choose a wellness path</span>
      <div className="path-slider-controls" aria-label="Wellness path slider controls">
        <button type="button" onClick={() => moveSlider(-1)} aria-label="Show previous wellness path">&#8592;</button>
        <button type="button" onClick={() => moveSlider(1)} aria-label="Show next wellness path">&#8594;</button>
      </div>
    </div>
    {availabilityMessage && <div className="path-availability-message" role="status">{availabilityMessage}</div>}
    <div
      className="path-grid"
      ref={sliderRef}
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >{PATHS.map(([name, body, image], i) => <motion.button
      type="button"
      className="path-card"
      key={name}
      aria-label={`Find Ayurvedic centers offering ${name}`}
      aria-busy={busyService === name}
      onClick={() => void openService(name)}
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: .5 }}
      transition={{ delay: (i % 3) * .06, duration: .7 }}
    >
      <motion.span className="path-card-media" initial={{ opacity: 0, scale: 1.06 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: .35 }} transition={{ duration: 1.1, delay: .12 + (i % 3) * .05 }}>
        <Image src={image} alt="" fill sizes="(max-width: 600px) 88vw, (max-width: 900px) 50vw, 33vw" quality={82} />
      </motion.span>
      <span className="path-leaf">0{i + 1}</span><h3>{name}</h3><p>{body}</p>
    </motion.button>)}</div>
  </div></section>;
}
