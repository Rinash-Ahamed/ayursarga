"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";

const STEPS = [
  {
    label: "Discover",
    title: "Explore approved centers",
    body: "Search active Ayurvedic centers by name, city, or state and understand the kind of care each center offers.",
    outcome: "No account is needed to explore",
  },
  {
    label: "Understand",
    title: "Review services clearly",
    body: "Open a center to review its active treatments, descriptions, duration, listed price, and practical contact information.",
    outcome: "Compare at your own pace",
  },
  {
    label: "Choose",
    title: "Select suitable care",
    body: "Choose the center and service you want to discuss. Ayursarga keeps your selection ready while you sign in securely.",
    outcome: "Google sign-in begins only here",
  },
  {
    label: "Request",
    title: "Share your preference",
    body: "Send your preferred date, time, and any helpful notes. This is an appointment request, not an automatic confirmation.",
    outcome: "Sent directly to your chosen center",
  },
  {
    label: "Continue",
    title: "Receive and track the response",
    body: "The center can confirm, decline, or propose another time. Follow each update securely inside My Ayursarga.",
    outcome: "Clinical guidance remains with the center",
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
        <div className="process-intro-layout">
          <div>
            <RevealWords text="How Ayursarga Works" className="eyebrow" />
            <RevealLines as="h2" className="section-title" lines={["A clear path from", "discovery to care."]} />
            <FadeUp as="p" className="section-intro process-summary">
              Ayursarga brings center discovery, service information, appointment requests, and hospital responses into one calm and transparent journey.
            </FadeUp>
          </div>
          <FadeUp className="process-principles">
            <div><strong>Explore first</strong><span>Browse centers and services before signing in.</span></div>
            <div><strong>Request with clarity</strong><span>Your chosen centre will review every appointment request.</span></div>
            <div><strong>Care stays clinical</strong><span>Qualified physicians at the centre will confirm your treatment suitability.</span></div>
          </FadeUp>
        </div>

        <ol className="process-journey" aria-label="The Ayursarga care journey">
          {STEPS.map(({ label, title, body, outcome }, index) => (
            <li id={index === 0 ? "discover-hospitals" : undefined} key={title}>
              <FadeUp as="article" className="process-card" delay={index * 0.05}>
                <div className="process-card-heading"><StepIcon index={index} /></div>
                <span className="process-stage">{label}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className="process-outcome"><span aria-hidden="true">&#10003;</span>{outcome}</span>
              </FadeUp>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
