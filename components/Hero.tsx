"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import MagneticButton from "./MagneticButton";

const CORE_VALUES = [
  { title: "Care", description: "Mother and baby always come first." },
  { title: "Authenticity", description: "Ayurveda practiced responsibly." },
  { title: "Trust", description: "Honest, transparent and accountable." },
  { title: "Excellence", description: "Quality care, every day." },
  { title: "Growth", description: "Growing together, creating impact." },
] as const;

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeValue, setActiveValue] = useState(0);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (shouldReduceMotion || !isHeroVisible) return;
    const interval = window.setInterval(() => {
      setActiveValue((current) => (current + 1) % CORE_VALUES.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, [isHeroVisible, shouldReduceMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldReduceMotion || !isHeroVisible) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [isHeroVisible, shouldReduceMotion]);

  return (
    <section id="hero" ref={heroRef}>
      <video ref={videoRef} className="hero-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
        <source src="/hero%20image%20video.mp4" type="video/mp4" media="(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)" />
      </video>
      <div className="hero-content">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>Ayurvedic care, guided with trust</motion.p>
        <h1>
          {["Ayurvedic care,", "personally guided."].map((line, index) => (
            <span key={line}><motion.span
              initial={{ y: "115%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 1.05, delay: 0.28 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >{index === 1 ? <span className="hero-heading-emphasis">{line}</span> : line}</motion.span></span>
          ))}
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.82, duration: 0.8 }}>
          Discover trusted hospitals and wellness centres, compare your options, and connect with the care that fits your needs.
        </motion.p>
        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.7 }}>
          <MagneticButton href="/centers" className="btn-magnetic hero-search-button">
            <svg className="hero-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>
            <span>Search for Ayurvedic Center</span>
          </MagneticButton>
          <div className="hero-support-actions">
            <MagneticButton href="#contact" className="btn-magnetic btn-secondary">Talk to Ayursarga</MagneticButton>
            <a href="#wellness" className="btn-text">Help me choose &darr;</a>
          </div>
        </motion.div>
        <motion.div className="hero-values" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          <div className="hero-value-slider" aria-label={CORE_VALUES.map((value) => `${value.title}: ${value.description}`).join(" ")}>
            <div className="hero-value-copy" aria-live="off">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  className="hero-value-slide"
                  key={CORE_VALUES[activeValue].title}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <strong>{CORE_VALUES[activeValue].title}</strong>
                  <p>{CORE_VALUES[activeValue].description}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="hero-value-dots" aria-label="Choose a core value">
              {CORE_VALUES.map((value, index) => <button
                type="button"
                key={value.title}
                className={index === activeValue ? "active" : ""}
                aria-label={`Show ${value.title}`}
                aria-pressed={index === activeValue}
                onClick={() => setActiveValue(index)}
              />)}
            </div>
          </div>
          <p className="hero-tagline">Nurturing Mothers. Preserving Tradition. Building Trust.</p>
        </motion.div>
      </div>
    </section>
  );
}
