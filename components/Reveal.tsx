"use client";

import { motion } from "framer-motion";
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
  const animationProps = {
    id,
    className,
    initial: { opacity: 0, y: 36 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.7 },
    transition: { duration: 1, delay, ease: [0.22, 1, 0.36, 1] as const },
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
