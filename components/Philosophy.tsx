"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";

const STEPS = [
  ["01", "Tell us what you need", "Share the kind of care, location, privacy and support you are looking for."],
  ["02", "Receive matched retreats", "We shortlist verified Ayurvedic centres that fit your needs and preferences."],
  ["03", "Compare with clarity", "Review ambience, facilities and packages without chasing multiple providers."],
  ["04", "Confirm with Ayursarga", "Choose confidently with one point of contact guiding your booking."],
  ["05", "Arrive and restore", "Step into a seamless wellness experience planned around you."],
];

export default function Philosophy() {
  return (
    <section id="how-it-works" className="section">
      <div className="section-inner">
        <RevealWords text="How It Works" className="eyebrow" />
        <RevealLines as="h2" className="section-title" lines={["From what you need", "to where you heal."]} />
        <FadeUp as="p" className="section-intro">
          Finding the right Ayurvedic centre should feel reassuring. We make the journey personal, transparent and beautifully simple.
        </FadeUp>
        <div className="process-grid">
          {STEPS.map(([number, title, body], index) => (
            <FadeUp as="article" className="process-card" delay={index * 0.06} key={number}>
              <span className="process-number">{number}</span><h3>{title}</h3><p>{body}</p>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
