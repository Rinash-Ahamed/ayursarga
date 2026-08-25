"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import TreatmentFilm from "./TreatmentFilm";

export default function Therapies() {
  return <section id="wellness-experience" className="section wellness-experience-section"><div className="section-inner">
    <TreatmentFilm />
    <motion.div id="family-wellness" className="family-story" initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }}>
      <div className="family-story-media"><Image src="/wellness/mother-child-garden.png" alt="Mother and child exploring medicinal leaves in a Kerala retreat garden" width={1152} height={1440} sizes="(max-width: 900px) 100vw, 42vw" quality={82} /></div>
      <div className="family-story-copy"><span className="eyebrow">Mother &amp; Child</span><h3>Wellness that holds the whole family.</h3><p>From prenatal preparation to postnatal recovery, baby care and lactation support, explore active services from Ayursarga hospital partners.</p></div>
    </motion.div>
  </div></section>;
}
