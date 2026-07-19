"use client";

import { motion } from "framer-motion";
import { RevealLines, RevealWords } from "./Reveal";

const PATHS = [
  ["Postnatal recovery", "Restorative care for the mother after birth, with support options for baby and family."],
  ["Panchakarma", "Doctor-guided cleansing and renewal programmes tailored to your constitution."],
  ["Stress management", "Quiet stays, therapies and practices designed to settle an overextended system."],
  ["Weight management", "Sustainable Ayurvedic programmes built around food, movement and metabolic health."],
  ["PCOS care", "Holistic support for hormonal balance, daily rhythm and long-term wellbeing."],
  ["Women’s wellness", "Personalised care through changing seasons of a woman’s health."],
  ["Corporate wellness", "Restorative programmes for teams, leaders and high-pressure work cultures."],
  ["Couples retreat", "Shared time to slow down, reconnect and return home with healthier rhythms."],
  ["Detox retreat", "A considered reset through therapeutic care, nourishing food and genuine rest."],
];

export default function Therapies() {
  return <section id="wellness" className="section"><div className="section-inner">
    <RevealWords text="Wellness Paths" className="eyebrow" />
    <RevealLines as="h2" className="section-title" lines={["Care for where", "you are now."]} />
    <p className="section-intro">From maternal care to deep rejuvenation, explore programmes selected around your goals—not a generic package list.</p>
    <div className="path-grid">{PATHS.map(([name, body], i) => <motion.article className="path-card" key={name} initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .5 }} transition={{ delay: (i % 3) * .06, duration: .7 }}>
      <span className="path-leaf">⌁</span><h3>{name}</h3><p>{body}</p><a href="#matching">Find a match <span>↗</span></a>
    </motion.article>)}</div>
  </div></section>;
}
