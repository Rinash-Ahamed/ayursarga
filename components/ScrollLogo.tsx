"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollLogo() {
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;

    const scrollTrigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: ({ progress }) => {
        const scale = 0.72 + progress * 0.34;
        logo.style.transform = `scale(${scale})`;
        logo.style.opacity = `${0.48 + progress * 0.52}`;
      },
    });

    return () => scrollTrigger.kill();
  }, []);

  return (
    <div className="scroll-logo" aria-hidden="true">
      <div ref={logoRef} className="scroll-logo-mark">
        <Image src="/mainlogo.png" alt="" width={54} height={54} loading="eager" quality={90} sizes="54px" />
      </div>
    </div>
  );
}
