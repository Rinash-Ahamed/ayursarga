"use client";

import { useEffect, useRef, useState } from "react";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";

const BENEFITS = [
  ["Approved hospital partners", "Only active hospitals approved for public discovery appear to consumers."],
  ["Hospital-confirmed requests", "Hospitals confirm, reject or propose another time for each appointment request."],
  ["Visible service pricing", "Review the listed service price before sending your appointment request."],
  ["Guidance when needed", "An Ayursarga guide can help when you are unsure where to begin."],
  ["Booking status clarity", "Follow requested, confirmed, rescheduled, cancelled and completed appointments."],
  ["Role-protected access", "Consumer, hospital and admin areas are separated according to account access."],
];

export default function Sanctuary() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeBenefit, setActiveBenefit] = useState(-1);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (timer) clearInterval(timer);

      if (!entry.isIntersecting) {
        setActiveBenefit(-1);
        return;
      }

      setActiveBenefit(0);
      timer = setInterval(() => {
        setActiveBenefit((current) => (current + 1) % BENEFITS.length);
      }, 1800);
    }, { threshold: 0.3 });

    observer.observe(section);
    return () => {
      if (timer) clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return <section ref={sectionRef} id="why-ayursarga" className="section dark-section"><div className="section-inner trust-layout">
    <div className="trust-copy"><RevealWords text="Why Ayursarga" className="eyebrow light" /><RevealLines as="h2" className="section-title light" lines={["Choice, without", "the uncertainty."]} /><FadeUp as="p" className="light-body">We connect consumers with approved Ayurvedic hospitals through clear services, appointment requests and human guidance when needed.</FadeUp></div>
    <div className="benefit-list">{BENEFITS.map(([title, body], i) => <article className={activeBenefit === i ? "is-active" : undefined} key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
  </div></section>;
}
