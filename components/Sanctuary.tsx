"use client";

import { FadeUp, RevealLines, RevealWords } from "./Reveal";

const BENEFITS = [
  ["Verified partners", "Centres are considered for the quality, credibility and consistency of their care."],
  ["Doctor-guided matching", "Clinical needs help shape the shortlist—not just photographs or room rates."],
  ["Transparent pricing", "Understand packages and inclusions clearly before you confirm."],
  ["One point of contact", "A single Ayursarga guide supports you from first question to booking."],
  ["Personal recommendations", "Your care, privacy, family needs, location and budget all matter."],
  ["Confidential booking", "Your health information and preferences are handled with discretion."],
];

export default function Sanctuary() {
  return <section id="why-ayursarga" className="section dark-section"><div className="section-inner trust-layout">
    <div><RevealWords text="Why Ayursarga" className="eyebrow light" /><RevealLines as="h2" className="section-title light" lines={["Choice, without", "the uncertainty."]} /><FadeUp as="p" className="light-body">We bring thoughtful curation and human guidance to a category that can otherwise feel difficult to compare.</FadeUp></div>
    <div className="benefit-list">{BENEFITS.map(([title, body], i) => <FadeUp as="article" delay={i * .05} key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></FadeUp>)}</div>
  </div></section>;
}
