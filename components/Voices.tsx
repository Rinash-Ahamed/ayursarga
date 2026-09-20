"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";
import { ROUTES } from "@/config/routes";

const POINTS = [
  ["reach", "Reach active consumers"],
  ["services", "Manage service listings"],
  ["appointments", "Receive appointment requests"],
  ["schedule", "Confirm or reschedule requests"],
  ["commission", "Agreed commission model"],
  ["onboarding", "Admin-controlled onboarding"],
] as const;
const PARTNER_STEPS = [
  ["hospital", "Tell us about your hospital", "Share your location, specialties, services, and the care you want patients to discover."],
  ["review", "Complete review and onboarding", "Our team reviews your details, explains the platform terms, and activates an approved hospital account."],
  ["requests", "List care and receive requests", "Publish active services, then manage appointment requests, confirmations, and rescheduling from your Hospital portal."],
] as const;

function PartnerStepIcon({ name }: { name: (typeof PARTNER_STEPS)[number][0] }) {
  return <span className="partner-step-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {name === "hospital" && <>
        <path d="M3 21h18M5.5 21V5.5h13V21M9 9h6M12 6v6M8.5 15h2M13.5 15h2M10 21v-3.5h4V21" />
      </>}
      {name === "review" && <>
        <path d="M9 5h6M9 3.5h6v3H9zM7 5H5.5v16h13V5H17" />
        <path d="m8.5 14 2.2 2.2 4.8-5" />
      </>}
      {name === "requests" && <>
        <path d="M6.5 3v3M17.5 3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z" />
        <path d="m8.5 14 2.1 2.1 4.7-4.7" />
      </>}
    </svg>
  </span>;
}

function PartnerPointIcon({ name }: { name: (typeof POINTS)[number][0] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "reach" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 7h5M18.5 4.5v5" /></>}
    {name === "services" && <><path d="M5 6h7M5 12h7M5 18h7" /><path d="M16 7c3 0 4.5-1.5 4.5-4-3 0-4.5 1.5-4.5 4Zm0 0v12M16 13c-2.5 0-4-1.4-4-3.8 2.5 0 4 1.4 4 3.8Zm0 3c2.5 0 4-1.4 4-3.8-2.5 0-4 1.4-4 3.8Z" /></>}
    {name === "appointments" && <><path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" /><path d="m9 14 2 2 4-4" /></>}
    {name === "schedule" && <><path d="M6 4h12v16H6zM9 2v4M15 2v4M6 9h12" /><path d="M9 14h6m0 0-2-2m2 2-2 2" /></>}
    {name === "commission" && <><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /><path d="m18.5 5.5-13 13" /></>}
    {name === "onboarding" && <><path d="M12 3 19 6v5c0 4.5-2.7 8-7 10-4.3-2-7-5.5-7-10V6l7-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>}
  </svg>;
}

export default function Voices() {
  const prefersReducedMotion = useReducedMotion();

  return <section id="partners" className="section partner-section"><div className="section-inner partner-panel">
    <div className="partner-heading"><RevealWords text="For Ayurvedic Hospitals" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={["Good care deserves", "to be discovered."]} /></div>
    <div className="partner-copy-column">
      <div className="partner-copy"><FadeUp as="p" className="section-intro partner-intro">Partner with Ayursarga to help people discover your hospital, understand your services, and send appointment requests to your team. Clinical decisions remain with your qualified physicians.</FadeUp><FadeUp className="partner-action"><MagneticButton href={`${ROUTES.public.contact}?interest=partnership`} className="btn-magnetic btn-primary">Discuss partnership</MagneticButton></FadeUp></div>
      <ul className="partner-points">{POINTS.map(([icon, point], index) => <li key={icon}><motion.span className="partner-point-icon"
        aria-hidden="true"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: .2, rotate: -28 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, scale: [0.2, 1.2, 1], rotate: [-28, 6, 0] }}
        viewport={{ once: true, amount: .45 }}
        transition={{ duration: .58, delay: .12 + index * .1, ease: [0.22, 1, 0.36, 1] }}
      ><PartnerPointIcon name={icon} /></motion.span><span>{point}</span></li>)}</ul>
    </div>
    <FadeUp className="partner-image"><Image src="/ayurvedic-hospital-partner.webp" alt="Ayurvedic hospital with a medicinal garden in Kerala" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 48vw" quality={82} /></FadeUp>
    <FadeUp as="ul" className="partner-steps">{PARTNER_STEPS.map(([icon, title, body]) => <li key={icon}><PartnerStepIcon name={icon} /><div><strong>{title}</strong><p>{body}</p></div></li>)}</FadeUp>
  </div></section>;
}
