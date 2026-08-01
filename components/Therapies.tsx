"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { RevealLines, RevealWords } from "./Reveal";
import TreatmentFilm from "./TreatmentFilm";

const PATHS = [
  ["Postnatal recovery", "Restorative care for the mother after birth, with support options for baby and family.", "/Postnatal Recovery.jpeg"],
  ["Panchakarma", "Doctor-guided cleansing and renewal programmes tailored to your constitution.", "/Panchakarma.jpeg"],
  ["Stress management", "Quiet stays, therapies and practices designed to settle an overextended system.", "/Stress Managemen.jpeg"],
  ["Weight management", "Sustainable Ayurvedic programmes built around food, movement and metabolic health.", "/WT Management.jpeg"],
  ["PCOS care", "Holistic support for hormonal balance, daily rhythm and long-term wellbeing.", "/PCOS Care.jpeg"],
  ["Women’s wellness", "Personalised care through changing seasons of a woman’s health.", "/Womesn Wellness.jpeg"],
  ["Corporate wellness", "Restorative programmes for teams, leaders and high-pressure work cultures.", "/Corperate Wellness.jpeg"],
  ["Couples retreat", "Shared time to slow down, reconnect and return home with healthier rhythms.", "/Couplea Retreat.jpeg"],
  ["Detox retreat", "A considered reset through therapeutic care, nourishing food and genuine rest.", "/Detox Retreat.jpeg"],
];

export default function Therapies() {
  return <section id="wellness" className="section"><div className="section-inner">
    <RevealWords text="Wellness Paths" className="eyebrow" />
    <RevealLines as="h2" className="section-title" lines={["Care for where", "you are now."]} />
    <p className="section-intro">From maternal care to deep rejuvenation, explore programmes selected around your goals - not a generic package list.</p>
    <TreatmentFilm />
    <motion.div className="family-story" initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }}>
      <Image src="/mother-child-garden.png" alt="Mother and child exploring medicinal leaves in a Kerala retreat garden" width={1152} height={1440} sizes="(max-width: 900px) 100vw, 42vw" quality={82} />
      <div><span className="eyebrow">Mother &amp; Child</span><h3>Wellness that holds the whole family.</h3><p>From prenatal preparation to postnatal recovery, baby care and lactation support, we match the details that make a stay truly restorative.</p><a href="#matching">Find maternal care <span>→</span></a></div>
    </motion.div>
    <div className="path-grid">{PATHS.map(([name, body, image], i) => <motion.article className="path-card" key={name} initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .5 }} transition={{ delay: (i % 3) * .06, duration: .7 }}>
      <motion.div className="path-card-media" initial={{ opacity: 0, scale: 1.06 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: .35 }} transition={{ duration: 1.1, delay: .12 + (i % 3) * .05 }}>
        <Image src={image} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" quality={82} />
      </motion.div>
      <span className="path-leaf">0{i + 1}</span><h3>{name}</h3><p>{body}</p><a href="#matching">Find a match <span aria-hidden="true">↗</span></a>
    </motion.article>)}</div>
  </div></section>;
}
