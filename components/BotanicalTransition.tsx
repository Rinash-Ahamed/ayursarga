"use client";

import { motion } from "framer-motion";

type Tone = "cream" | "cream-to-forest" | "forest-to-cream";

const LEAVES = [
  { x: 205, y: 78, r: -34, flip: 1 },
  { x: 330, y: 62, r: 28, flip: -1 },
  { x: 485, y: 83, r: -30, flip: 1 },
  { x: 650, y: 59, r: 30, flip: -1 },
  { x: 805, y: 77, r: -32, flip: 1 },
  { x: 955, y: 55, r: 29, flip: -1 },
];

export default function BotanicalTransition({ tone = "cream", reverse = false }: { tone?: Tone; reverse?: boolean }) {
  return <div className={`botanical-transition ${tone}${reverse ? " reverse" : ""}`} aria-hidden="true">
    <motion.svg viewBox="0 0 1200 150" preserveAspectRatio="none" initial="hidden" whileInView="visible" viewport={{ once: true, amount: .55 }}>
      <motion.path
        className="botanical-stem"
        d="M-20 106 C165 104 190 62 350 75 S610 108 760 69 S1010 48 1220 74"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 1.8, ease: [0.22, 1, 0.36, 1] } } }}
      />
      {LEAVES.map((leaf, index) => <g key={leaf.x} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.flip} 1)`}>
        <motion.path
          className="botanical-leaf"
          d="M0 0 C13 -26 42 -29 61 -16 C45 4 20 10 0 0 Z"
          variants={{ hidden: { opacity: 0, scale: .15 }, visible: { opacity: 1, scale: 1, transition: { duration: .65, delay: .42 + index * .12, ease: [0.22, 1, 0.36, 1] } } }}
        />
        <motion.path
          className="botanical-vein"
          d="M4 -1 C22 -8 39 -13 56 -16"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { duration: .55, delay: .7 + index * .1 } } }}
        />
      </g>)}
    </motion.svg>
  </div>;
}
