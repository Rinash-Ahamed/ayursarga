"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";

const POINTS = ["Reach active consumers", "Manage service listings", "Receive appointment requests", "Confirm or reschedule requests", "Agreed commission model", "Admin-controlled onboarding"];

export default function Voices() {
  return <section id="partners" className="section partner-section"><div className="section-inner partner-panel">
    <div className="partner-copy"><RevealWords text="For Ayurvedic Hospitals" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={["Good care deserves", "to be discovered."]} /><FadeUp as="p" className="section-intro partner-intro">Apply to partner with Ayursarga. Hospital access is created only after review, agreement to platform terms and admin approval.</FadeUp><FadeUp><MagneticButton href="#contact" className="btn-magnetic btn-primary">Apply to Partner</MagneticButton></FadeUp></div>
    <FadeUp as="ul" className="partner-points">{POINTS.map((point) => <li key={point}><span>✓</span>{point}</li>)}</FadeUp>
  </div></section>;
}
