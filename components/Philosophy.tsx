"use client";

import { FadeUp } from "./Reveal";

const STEPS = [
  {
    label: "Discover",
    title: "Explore approved centers",
    body: "Find approved Ayurvedic centers by name or location.",
  },
  {
    label: "Understand",
    title: "Review services clearly",
    body: "Compare treatments, duration, pricing, and center details.",
  },
  {
    label: "Choose",
    title: "Select suitable care",
    body: "Select the center and care option that suits your needs.",
  },
  {
    label: "Request",
    title: "Share your preference",
    body: "Share your preferred date, time, and helpful notes.",
  },
  {
    label: "Continue",
    title: "Receive and track the response",
    body: "Track confirmations, changes, and responses in My Ayursarga.",
  },
] as const;

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
        <ol className="process-journey" aria-label="The Ayursarga care journey">
          {STEPS.map(({ label, title, body }, index) => (
            <li id={index === 0 ? "discover-hospitals" : undefined} key={title}>
              <FadeUp as="article" className="process-card" delay={index * 0.05}>
                <div className="process-card-heading"><StepIcon index={index} /></div>
                <span className="process-stage">{label}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </FadeUp>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
