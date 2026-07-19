"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";

const POINTS = ["Increase occupancy", "Receive qualified clients", "No marketing burden", "Flexible commission model", "Professional onboarding", "Reach a wider client network"];

export default function Voices() {
  return <section id="partners" className="section partner-section"><div className="section-inner partner-panel">
    <div><RevealWords text="For Centres & Resorts" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={["Good care deserves", "to be discovered."]} /><FadeUp as="p" className="section-intro">Partner with Ayursarga to meet people already looking for the kind of trusted Ayurvedic experience you provide.</FadeUp><FadeUp><MagneticButton href="#contact" className="btn-magnetic btn-primary">Partner With Us</MagneticButton></FadeUp></div>
    <FadeUp as="ul" className="partner-points">{POINTS.map((point) => <li key={point}><span>✓</span>{point}</li>)}</FadeUp>
  </div></section>;
}
