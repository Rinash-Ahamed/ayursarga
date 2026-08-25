"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import TreatmentFilm from "./TreatmentFilm";

export default function Therapies() {
  return <section id="wellness-experience" className="section wellness-experience-section"><div className="section-inner">
    <TreatmentFilm />
    <motion.div id="family-wellness" className="family-story" initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }}>
      <div className="family-story-media"><Image src="/wellness/mother-child-garden.png" alt="Mother and child exploring medicinal leaves in a Kerala retreat garden" width={1152} height={1440} sizes="(max-width: 900px) 100vw, 42vw" quality={82} /></div>
      <div className="family-story-copy">
        <span className="eyebrow">Care for every generation</span>
        <h3>Wellness that holds the whole family.</h3>
        <p>From prenatal preparation to postnatal recovery, baby care and lactation support, explore active services from Ayursarga hospital partners.</p>
        <ul className="family-care-points">
          <li><FamilyCareIcon name="journey" /><span><strong>Care across life stages</strong><small>Thoughtful support from preparation through recovery.</small></span></li>
          <li><FamilyCareIcon name="family" /><span><strong>Mother-and-child support</strong><small>Wellness paths shaped around two connected journeys.</small></span></li>
          <li><FamilyCareIcon name="clinical" /><span><strong>Clinically guided Ayurveda</strong><small>Treatment suitability remains with qualified physicians.</small></span></li>
        </ul>
        <a className="family-story-action" href="#wellness">Explore family wellness <span aria-hidden="true">&rarr;</span></a>
      </div>
    </motion.div>
  </div></section>;
}

function FamilyCareIcon({ name }: { name: "journey" | "family" | "clinical" }) {
  return <span className="family-care-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {name === "journey" && <><path d="M5 19c1-6 4-10 9-13" /><path d="M13 6h5v5" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="6" r="2" /></>}
    {name === "family" && <><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="10" r="2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M13 20a4 4 0 0 1 8 0" /></>}
    {name === "clinical" && <><path d="M12 21c4-3.4 7-7 7-11a4 4 0 0 0-7-2.7A4 4 0 0 0 5 10c0 4 3 7.6 7 11Z" /><path d="M9 12h2l1-2 1.5 4 1-2H17" /></>}
  </svg></span>;
}
