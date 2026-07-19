"use client";

import { useRef } from "react";
import { motion, MotionValue, useScroll, useTransform } from "framer-motion";

type Tone = "cream" | "cream-to-forest" | "forest-to-cream";

const LEAVES = [
  { x: 205, y: 78, r: -34, flip: 1 },
  { x: 330, y: 62, r: 28, flip: -1 },
  { x: 485, y: 83, r: -30, flip: 1 },
  { x: 650, y: 59, r: 30, flip: -1 },
  { x: 805, y: 77, r: -32, flip: 1 },
  { x: 955, y: 55, r: 29, flip: -1 },
];

function BranchLeaf({ progress, index, x, y, r, flip }: { progress: MotionValue<number>; index: number; x: number; y: number; r: number; flip: number }) {
  const start = .16 + index * .115;
  const end = Math.min(start + .16, 1);
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const scale = useTransform(progress, [start, end], [.12, 1]);
  const veinLength = useTransform(progress, [Math.min(start + .05, 1), end], [0, 1]);
  return <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip} 1)`}>
    <motion.path className="botanical-leaf" style={{ opacity, scale, transformOrigin: "0px 0px" }} d="M0 0 C13 -26 42 -29 61 -16 C45 4 20 10 0 0 Z" />
    <motion.path className="botanical-vein" style={{ opacity, pathLength: veinLength }} d="M4 -1 C22 -8 39 -13 56 -16" />
  </g>;
}

export default function BotanicalTransition({ tone = "cream", reverse = false }: { tone?: Tone; reverse?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: container, offset: ["start 96%", "end 44%"] });
  const stemOpacity = useTransform(scrollYProgress, [0, .06], [0, 1]);
  return <div ref={container} className={`botanical-transition ${tone}${reverse ? " reverse" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 1200 150" preserveAspectRatio="none">
      <motion.path className="botanical-stem" style={{ pathLength: scrollYProgress, opacity: stemOpacity }} d="M-20 106 C165 104 190 62 350 75 S610 108 760 69 S1010 48 1220 74" />
      {LEAVES.map((leaf, index) => <BranchLeaf key={leaf.x} progress={scrollYProgress} index={index} {...leaf} />)}
    </svg>
  </div>;
}
