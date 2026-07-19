"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import Image from "next/image";

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
        <FadeUp className="maternal-editorial">
          <Image src="/mother-newborn-ayurveda.png" alt="Mother resting with her newborn at an Ayurvedic retreat" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 70vw" />
          <div><span>Care, considered</span><p>For mother, child and every practical need around them.</p></div>
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
