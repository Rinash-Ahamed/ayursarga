"use client";

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
  return <section id="why-ayursarga" className="section dark-section"><div className="section-inner trust-layout">
    <div><RevealWords text="Why Ayursarga" className="eyebrow light" /><RevealLines as="h2" className="section-title light" lines={["Choice, without", "the uncertainty."]} /><FadeUp as="p" className="light-body">We connect consumers with approved Ayurvedic hospitals through clear services, appointment requests and human guidance when needed.</FadeUp></div>
    <div className="benefit-list">{BENEFITS.map(([title, body], i) => <FadeUp as="article" delay={i * .05} key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></FadeUp>)}</div>
  </div></section>;
}
