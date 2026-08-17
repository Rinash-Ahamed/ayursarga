"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import Image from "next/image";

const STEPS = [
  ["Discover approved hospitals", "Explore Ayurvedic hospitals offering care paths suited to different wellness needs."],
  ["Compare treatments and care", "Review active treatments, programme details, transparent prices and practical hospital information."],
  ["Request your consultation", "Sign in, choose your preferred date and time, and share any notes about the care you seek."],
  ["Receive hospital guidance", "The hospital can confirm your request or suggest another suitable time for your consultation."],
  ["Follow your wellness journey", "Track each appointment update securely from your Ayursarga consumer account."],
];

function StepIcon({ index }: { index: number }) {
  const paths = [
    <><path d="M5 19V9l7-4 7 4v10" /><path d="M9 19v-5h6v5M3 19h18" /><path d="M16 7c1-2 3-3 5-3-1 3-2 4-5 4" /></>,
    <><path d="M4 7h7M4 12h7M4 17h7" /><path d="M15 6c3 0 5 2 5 5-3 0-5-2-5-5ZM15 18c0-3 2-5 5-5 0 3-2 5-5 5Z" /></>,
    <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M10 15c2-2 4-2 6-1-1 2-3 3-6 1Z" /></>,
    <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 10h8M8 13h5" /><path d="M16 7c1-2 3-2 4-2-1 2-2 3-4 2Z" /></>,
    <><path d="M4 19c2-7 5-11 10-14" /><path d="M8 14c-2 0-4-1-5-3 3-1 5 0 6 2M12 9c0-3 2-5 5-6 0 3-1 5-4 7" /><path d="m14 17 2 2 4-5" /></>,
  ];
  return <span className="process-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">{paths[index]}</svg></span>;
}

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
          <Image src="/how-it-works-ayurvedic-guidance.png" alt="Ayurvedic doctor guiding a family through a care plan" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 70vw" quality={86} />
          <div><span>Care, considered</span><p>Understand hospital services with calm guidance before you request care.</p></div>
        </FadeUp>
        <div className="process-grid">
          {STEPS.map(([title, body], index) => (
            <FadeUp id={index === 0 ? "discover-hospitals" : undefined} as="article" className="process-card" delay={index * 0.06} key={title}>
              <div className="process-card-heading"><StepIcon index={index} /></div><h3>{title}</h3><p>{body}</p>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
