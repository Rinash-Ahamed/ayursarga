"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { RevealLines, RevealWords } from "./Reveal";
import TreatmentFilm from "./TreatmentFilm";

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
    <p className="section-intro">From maternal care to deep rejuvenation, explore programmes selected around your goals - not a generic package list.</p>
    <TreatmentFilm />
    <motion.div className="family-story" initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }}>
      <Image src="/mother-child-garden.png" alt="Mother and child exploring medicinal leaves in a Kerala retreat garden" width={1152} height={1440} sizes="(max-width: 900px) 100vw, 42vw" />
      <div><span className="eyebrow">Mother &amp; Child</span><h3>Wellness that holds the whole family.</h3><p>From prenatal preparation to postnatal recovery, baby care and lactation support, we match the details that make a stay truly restorative.</p><a href="#matching">Find maternal care <span>→</span></a></div>
    </motion.div>
    <div className="path-grid">{PATHS.map(([name, body], i) => <motion.article className="path-card" key={name} initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .5 }} transition={{ delay: (i % 3) * .06, duration: .7 }}>
      <span className="path-leaf">⌁</span><h3>{name}</h3><p>{body}</p><a href="#matching">Find a match <span>↗</span></a>
    </motion.article>)}</div>
  </div></section>;
}
