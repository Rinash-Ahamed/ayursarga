"use client";

import Image from "next/image";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";

const POINTS = ["Reach active consumers", "Manage service listings", "Receive appointment requests", "Confirm or reschedule requests", "Agreed commission model", "Admin-controlled onboarding"];
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

export default function Voices() {
  return <section id="partners" className="section partner-section"><div className="section-inner partner-panel">
    <div className="partner-copy"><RevealWords text="For Ayurvedic Hospitals" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={["Good care deserves", "to be discovered."]} /><FadeUp as="p" className="section-intro partner-intro">Partner with Ayursarga to help people discover your hospital, understand your services, and send appointment requests to your team. Clinical decisions remain with your qualified physicians.</FadeUp><FadeUp className="partner-action"><MagneticButton href="#contact" className="btn-magnetic btn-primary">Discuss partnership</MagneticButton></FadeUp><FadeUp className="partner-note">Booking requests begin after approval, activation, and service publication. Booking volume is not guaranteed.</FadeUp></div>
    <div className="partner-visual-column">
      <FadeUp className="partner-image"><Image src="/ayurvedic-hospital-partner.webp" alt="Ayurvedic hospital with a medicinal garden in Kerala" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 48vw" quality={82} /></FadeUp>
      <FadeUp as="ul" className="partner-points">{POINTS.map((point) => <li key={point}><span>&#10003;</span>{point}</li>)}</FadeUp>
    </div>
    <FadeUp as="ul" className="partner-steps">{PARTNER_STEPS.map(([icon, title, body]) => <li key={icon}><PartnerStepIcon name={icon} /><div><strong>{title}</strong><p>{body}</p></div></li>)}</FadeUp>
  </div></section>;
}
