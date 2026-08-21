"use client";

import Image from "next/image";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";

const POINTS = ["Reach active consumers", "Manage service listings", "Receive appointment requests", "Confirm or reschedule requests", "Agreed commission model", "Admin-controlled onboarding"];
const PARTNER_STEPS = [
  ["01", "Tell us about your hospital", "Share your location, specialties, services, and the care you want patients to discover."],
  ["02", "Complete review and onboarding", "Our team reviews your details, explains the platform terms, and activates an approved hospital account."],
  ["03", "List care and receive requests", "Publish active services, then manage appointment requests, confirmations, and rescheduling from your Hospital portal."],
] as const;

export default function Voices() {
  return <section id="partners" className="section partner-section"><div className="section-inner partner-panel">
    <div className="partner-copy"><RevealWords text="For Ayurvedic Hospitals" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={["Good care deserves", "to be discovered."]} /><FadeUp as="p" className="section-intro partner-intro">Partner with Ayursarga to help people discover your hospital, understand your services, and send appointment requests to your team. Clinical decisions remain with your qualified physicians.</FadeUp><FadeUp className="partner-action"><MagneticButton href="#contact" className="btn-magnetic btn-primary">Discuss partnership</MagneticButton></FadeUp><FadeUp className="partner-note">Booking requests begin after approval, activation, and service publication. Booking volume is not guaranteed.</FadeUp></div>
    <div className="partner-visual-column">
      <FadeUp className="partner-image"><Image src="/ayurvedic-hospital-partner.webp" alt="Ayurvedic hospital with a medicinal garden in Kerala" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 48vw" quality={82} /></FadeUp>
      <FadeUp as="ul" className="partner-points">{POINTS.map((point) => <li key={point}><span>&#10003;</span>{point}</li>)}</FadeUp>
    </div>
    <FadeUp as="ol" className="partner-steps">{PARTNER_STEPS.map(([number, title, body]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></li>)}</FadeUp>
  </div></section>;
}
