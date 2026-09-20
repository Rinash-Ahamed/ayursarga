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

export default function Footer({ sectionPrefix = "", backToTopHref }: { sectionPrefix?: string; backToTopHref?: string }) {
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
          <a href={ROUTES.public.contact}>Contact Us</a>
        </div>
      </motion.section>

      <div className="footer-directory">
        <div className="footer-directory-track">
          <nav className="footer-column footer-column-discover" aria-label="Discover Ayurvedic care">
            <h3>Discover</h3>
            <a href={ROUTES.public.postnatalCare}>Postnatal care</a>
            <a href={ROUTES.public.prenatalCare}>Prenatal care</a>
            <a href={ROUTES.public.babyCare}>Baby care</a>
            <a href={ROUTES.public.womensWellness}>Women wellness</a>
            <a href={ROUTES.public.ayurvedicWellness}>Ayurvedic wellness</a>
            <a href={ROUTES.public.onlineConsultation}>Online consultation</a>
          </nav>

          <nav className="footer-column footer-column-about" aria-label="Explore Ayursarga">
            <h3>About Us</h3>
            <a href={ROUTES.public.whoWeAre}>Who we are</a>
            <a href={ROUTES.public.howAyursargaWorks}>How Ayursarga works</a>
            <a href={ROUTES.public.whyAyursarga}>Why Ayursarga</a>
            <a href={ROUTES.public.missionVision}>Mission &amp; Vision</a>
          </nav>

          <nav className="footer-column footer-column-hospitals" aria-label="Hospital links">
            <h3>For hospitals</h3>
            <a href={ROUTES.hospital.login}>Hospital login</a>
            <a href={`${ROUTES.public.contact}?interest=partnership`}>Partner with Ayursarga</a>
            <a href={`${ROUTES.public.contact}?interest=partnership`}>Speak with our team</a>
          </nav>
        </div>

        <div className="footer-directory-track">
          <nav className="footer-column footer-column-legal" aria-label="Legal and policy information">
            <h3>Legal &amp; policies</h3>
            <span className="footer-pending-link">Privacy policy</span>
            <span className="footer-pending-link">Terms &amp; conditions</span>
            <span className="footer-pending-link">Cancellation &amp; refund policy</span>
          </nav>

          <nav className="footer-column footer-column-consumers" aria-label="Consumer links">
            <h3>For consumers</h3>
            <a href={ROUTES.consumer.register}>Register</a>
            <a href={ROUTES.public.centers}>Search hospitals</a>
            <a href={ROUTES.consumer.login}>Consumer login</a>
            <a href={ROUTES.consumer.bookings}>My bookings</a>
          </nav>
        </div>
      </div>

      <motion.div className="footer-identity" {...reveal}>
        <a href={sectionPrefix ? ROUTES.public.home : "#hero"} className="footer-mark" aria-label="Return to the Ayursarga home section">
          <span className="footer-logo-wrap" data-scroll-logo-target>
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
        <div className="footer-contact">
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

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Ayursarga. All rights reserved.</p>
        <p>Treatment suitability and clinical decisions are confirmed by the chosen hospital&apos;s qualified physician.</p>
        <a href={backToTopHref ?? (sectionPrefix ? "#site-nav" : "#hero")}>Back to top</a>
      </div>
    </div>
  </footer>;
}
