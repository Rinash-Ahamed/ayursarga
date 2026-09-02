"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";

const BENEFITS = [
  ["partners", "Approved hospital partners", "Only active hospitals approved for public discovery appear to consumers."],
  ["requests", "Hospital-confirmed requests", "Hospitals confirm, reject or propose another time for each appointment request."],
  ["pricing", "Visible service pricing", "Review the listed service price before sending your appointment request."],
  ["guidance", "Guidance when needed", "An Ayursarga guide can help when you are unsure where to begin."],
  ["status", "Booking status clarity", "Follow requested, confirmed, rescheduled, cancelled and completed appointments."],
  ["access", "Role-protected access", "Consumer, hospital and admin areas are separated according to account access."],
] as const;

type BenefitIconName = (typeof BENEFITS)[number][0];

function BenefitIcon({ name }: { name: BenefitIconName }) {
  const paths = {
    partners: <><path d="M12 3 5.5 5.8v5.1c0 4.2 2.7 7.9 6.5 10.1 3.8-2.2 6.5-5.9 6.5-10.1V5.8L12 3Z" /><path d="m9 12 2 2 4-5" /></>,
    requests: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4m8-4v4M4 10h16m-8 4 2 2 3-4" /></>,
    pricing: <><path d="M20 12 12 20l-8-8V5h7l9 7Z" /><circle cx="8.5" cy="8.5" r="1" /></>,
    guidance: <><path d="M5 13v-1a7 7 0 0 1 14 0v1M5 13H3v5h4v-5H5Zm14 0h2v5h-4v-5h2Zm0 5c0 2-2 3-4 3" /><path d="M15 21h-2" /></>,
    status: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h4" /></>,
    access: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  } satisfies Record<BenefitIconName, ReactNode>;

  return <span className="benefit-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}

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
    <div className="trust-visual">
      <span className="trust-media-label">Why Ayursarga</span>
      <div className="trust-media">
        <Image
          src="/why.png"
          alt="Ayursarga connecting trusted Ayurvedic hospitals, services, appointment requests and personal guidance"
          width={1402}
          height={1122}
          sizes="(max-width: 600px) calc(100vw - 44px), (max-width: 900px) calc(100vw - 80px), 43vw"
          quality={82}
        />
      </div>
    </div>
    <div className="trust-content">
      <div className="benefit-list">{BENEFITS.map(([icon, title, body], i) => <article className={activeBenefit === i ? "is-active" : undefined} key={title}><BenefitIcon name={icon} /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
    </div>
  </div></section>;
}
