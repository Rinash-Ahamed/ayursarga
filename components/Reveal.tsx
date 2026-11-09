"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FormEventHandler, ReactNode } from "react";

const motionTags = {
  article: motion.article,
  div: motion.div,
  form: motion.form,
  h2: motion.h2,
  ol: motion.ol,
  p: motion.p,
  ul: motion.ul,
};

type MotionTagName = keyof typeof motionTags;

export function FadeUp({
  children,
  id,
  className = "",
  delay = 0,
  as = "div",
  onSubmit,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  delay?: number;
  as?: MotionTagName;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  const reducedMotion = useReducedMotion();
  const animationProps = {
    id,
    className,
    initial: reducedMotion ? false as const : { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : Math.min(delay, 0.18), ease: [0.22, 1, 0.36, 1] as const },
  };

  if (as === "form") {
    return (
      <motion.form {...animationProps} onSubmit={onSubmit}>
        {children}
      </motion.form>
    );
  }

  const Tag = motionTags[as];
  return (
    <Tag
      {...animationProps}
    >
      {children}
    </Tag>
  );
}
