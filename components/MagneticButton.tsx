"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { PointerEvent, ReactNode, useRef } from "react";

export default function MagneticButton({
  href,
  children,
  className = "",
  onClick,
  type,
  disabled = false,
  ariaLabel,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 16, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 16, mass: 0.4 });
  const bounds = useRef<DOMRect | null>(null);

  function handleEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") bounds.current = event.currentTarget.getBoundingClientRect();
  }
  function handleMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse") return;
    const r = bounds.current ?? event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - r.left - r.width / 2) * 0.35);
    y.set((event.clientY - r.top - r.height / 2) * 0.5);
  }
  function handleLeave() {
    bounds.current = null;
    x.set(0);
    y.set(0);
  }

  if (type) {
    return (
      <motion.button
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        data-hover
        className={className}
        style={{ x: springX, y: springY }}
        onPointerEnter={handleEnter}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onClick={onClick}
      >
        <span>{children}</span>
      </motion.button>
    );
  }

  return (
    <motion.a
      href={href}
      data-hover
      className={className}
      style={{ x: springX, y: springY }}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={onClick}
    >
      <span>{children}</span>
    </motion.a>
  );
}
