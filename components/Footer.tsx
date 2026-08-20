"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ROUTES } from "@/config/routes";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.35 },
  transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
};

const wordmarkReveal = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

const wordmarkLetterReveal = {
  hidden: { opacity: 0, y: 9 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Footer({ sectionPrefix = "" }: { sectionPrefix?: string }) {
  const sectionHref = (anchor: string) => `${sectionPrefix}${anchor}`;
  const shouldReduceMotion = useReducedMotion();

  return <footer id="site-footer">
    <div className="footer-inner">
      <motion.section className="footer-invitation" {...reveal} aria-labelledby="footer-invitation-title">
        <div>
          <span className="footer-eyebrow">A considered beginning</span>
          <h2 id="footer-invitation-title">Ayurveda, personally matched.</h2>
          <p>Discover approved Ayurvedic hospitals, understand their care, and request an appointment with confidence.</p>
        </div>
        <div className="footer-invitation-actions">
          <a href={ROUTES.public.centers}>Search hospitals</a>
          <a href={sectionHref("#contact")}>Request guidance</a>
        </div>
      </motion.section>

      <div className="footer-directory">
        <motion.div className="footer-brand-column" {...reveal}>
          <a href={sectionPrefix ? ROUTES.public.home : "#hero"} className="footer-mark" aria-label="Return to the Ayursarga home section">
            <span className="footer-logo-wrap">
              <Image src="/mainlogo.png" alt="" width={58} height={58} loading="lazy" quality={90} sizes="58px" />
            </span>
            <motion.span
              className="footer-wordmark"
              variants={wordmarkReveal}
              initial={shouldReduceMotion ? false : "hidden"}
              whileInView="visible"
              viewport={{ once: true, amount: 0.8 }}
              aria-hidden="true"
            >
              {Array.from("Ayursarga").map((letter, index) => (
                <motion.span className="footer-wordmark-letter" variants={wordmarkLetterReveal} key={`${letter}-${index}`}>
                  {letter}
                </motion.span>
              ))}
            </motion.span>
          </a>
          <p>Helping people find suitable Ayurvedic hospital care across Kerala through clearer discovery and thoughtful guidance.</p>
          <div className="footer-contact">
            <span>Kerala, India</span>
            <a href="tel:+918086070680">
              <svg className="footer-contact-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 8.2 7.9 10a15.5 15.5 0 0 0 6.1 6.1l1.8-2.1 4.7 2.8-.8 3.1c-.2.7-.8 1.1-1.5 1.1C10.1 20.6 3.4 13.9 3 5.8c0-.7.4-1.3 1.1-1.5l3.1-.8Z" /></svg>
              <span>+91 8086070680</span>
            </a>
            <a href="mailto:info@ayursarga.com">
              <svg className="footer-contact-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z" /><path d="m4 7 8 6 8-6" /></svg>
              <span>info@ayursarga.com</span>
            </a>
          </div>
        </motion.div>

        <nav className="footer-column" aria-label="Explore Ayursarga">
          <h3>Explore</h3>
          <a href={sectionHref("#how-it-works")}>How it works</a>
          <a href={sectionHref("#wellness")}>Wellness paths</a>
          <a href={sectionHref("#why-ayursarga")}>Why Ayursarga</a>
          <a href={sectionHref("#contact")}>Personal guidance</a>
        </nav>

        <nav className="footer-column" aria-label="Consumer links">
          <h3>For consumers</h3>
          <a href={ROUTES.public.centers}>Search hospitals</a>
          <a href={ROUTES.consumer.register}>Register</a>
          <a href={ROUTES.consumer.login}>Consumer login</a>
          <a href={ROUTES.consumer.bookings}>My bookings</a>
        </nav>

        <nav className="footer-column" aria-label="Hospital links">
          <h3>For hospitals</h3>
          <a href={sectionHref("#partners")}>Partner with Ayursarga</a>
          <a href={ROUTES.hospital.login}>Hospital login</a>
          <a href={sectionHref("#contact")}>Speak with our team</a>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Ayursarga. All rights reserved.</p>
        <p>Treatment suitability and clinical decisions are confirmed by the chosen hospital&apos;s qualified physician.</p>
        <a href={sectionPrefix ? "#search-centers" : "#hero"}>Back to top</a>
      </div>
    </div>
  </footer>;
}
