"use client";

import { motion, Variants } from "framer-motion";
import { ElementType, ReactNode, useMemo } from "react";

const lineVariants: Variants = {
  hidden: { y: "115%" },
  visible: (i: number) => ({
    y: "0%",
    transition: { duration: 1, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function RevealLines({
  lines,
  as = "h2",
  className = "",
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
}) {
  const Tag: any = useMemo(() => motion(as as any), [as]);
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} style={{ display: "block", overflow: "hidden" }}>
          <motion.span
            style={{ display: "inline-block" }}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.85 }}
            variants={lineVariants}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

const wordVariants: Variants = {
  hidden: { y: "100%" },
  visible: (i: number) => ({
    y: "0%",
    transition: { duration: 0.7, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function RevealWords({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <p className={className}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", marginRight: "0.28em" }}>
          <motion.span
            style={{ display: "inline-block" }}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.9 }}
            variants={wordVariants}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </p>
  );
}

export function FadeUp({
  children,
  className = "",
  delay = 0,
  as = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
  [key: string]: any;
}) {
  const Tag: any = useMemo(() => motion(as as any), [as]);
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.7 }}
      transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
