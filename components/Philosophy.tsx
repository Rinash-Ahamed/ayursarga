"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import Image from "next/image";

const STEPS = [
  ["01", "Explore active hospitals", "Browse approved Ayurvedic hospitals available through Ayursarga."],
  ["02", "Compare their services", "Review active services, descriptions, prices and practical hospital information."],
  ["03", "Request an appointment", "Sign in and share your preferred date, time and any notes for the hospital."],
  ["04", "Receive a response", "The hospital can confirm, reject or propose a different appointment time."],
  ["05", "Track your booking", "Follow every status update securely from your Ayursarga consumer account."],
];

export default function Philosophy() {
  return (
    <section id="how-it-works" className="section">
      <div className="section-inner">
        <RevealWords text="How It Works" className="eyebrow" />
        <RevealLines as="h2" className="section-title" lines={["From hospital search", "to appointment request."]} />
        <FadeUp as="p" className="section-intro">
          Find suitable Ayurvedic hospitals, understand their services and request care through one clear, manageable process.
        </FadeUp>
        <FadeUp className="maternal-editorial">
          <Image src="/mother-newborn-ayurveda.png" alt="Mother resting with her newborn at an Ayurvedic retreat" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 70vw" quality={82} />
          <div><span>Care, considered</span><p>Explore hospital services for mother, child and the practical needs around them.</p></div>
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
