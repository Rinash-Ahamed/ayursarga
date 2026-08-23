"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RevealLines, RevealWords } from "./Reveal";
import TreatmentFilm from "./TreatmentFilm";

const PATHS = [
  ["Prenatal care", "Comprehensive care for mother and baby throughout pregnancy, with guidance and support for a healthy journey.", "/wellness/prenatal-care.jpg"],
  ["Postnatal care", "Restorative support after childbirth, helping the mother recover while nurturing the baby and family.", "/wellness/postnatal-care.jpeg"],
  ["Lactation support", "Dedicated lactation care for mother and baby, with guidance for confident and comfortable feeding.", "/wellness/lactation-support.jpg"],
  ["Panchakarma", "Doctor-guided cleansing and renewal programmes tailored to your constitution.", "/wellness/panchakarma.jpeg"],
  ["Women’s wellness", "Personalised Ayurvedic care supporting women’s health, hormonal balance, and wellbeing through every life stage.", "/wellness/womens-wellness.jpeg"],
  ["Stress management", "Quiet stays, therapies and practices designed to settle an overextended system.", "/wellness/stress-management.jpeg"],
] as const;

export default function Therapies() {
  const router = useRouter();
  const messageTimerRef = useRef<number | null>(null);
  const [busyService, setBusyService] = useState<string | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

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
      const { hasPublicHospitalForService } = await import("@/services/hospitals/publicHospitalService");
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
      <div className="family-story-media"><Image src="/wellness/mother-child-garden.png" alt="Mother and child exploring medicinal leaves in a Kerala retreat garden" width={1152} height={1440} sizes="(max-width: 900px) 100vw, 42vw" quality={82} /></div>
      <div className="family-story-copy"><span className="eyebrow">Mother &amp; Child</span><h3>Wellness that holds the whole family.</h3><p>From prenatal preparation to postnatal recovery, baby care and lactation support, explore active services from Ayursarga hospital partners.</p></div>
    </motion.div>
    <div className="path-grid-heading"><span>Choose a wellness path</span><p>Select a path to find Ayursarga centers currently offering that care.</p></div>
    {availabilityMessage && <div className="path-availability-message" role="status">{availabilityMessage}</div>}
    <div className="path-grid">{PATHS.map(([name, body, image], i) => <motion.button
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
      <motion.span className="path-card-media" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .7, delay: .1 + (i % 3) * .05 }}>
        <Image src={image} alt={`${name} Ayurvedic wellness care`} fill sizes="(max-width: 600px) calc(100vw - 44px), (max-width: 900px) 50vw, 33vw" quality={82} />
      </motion.span>
      <span className="path-card-copy"><h3>{name}</h3><p>{body}</p><span className="path-card-action">Explore centers <span aria-hidden="true">&#8594;</span></span></span>
    </motion.button>)}</div>
  </div></section>;
}
