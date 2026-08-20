"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ROUTES } from "@/config/routes";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.35 },
  transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Footer() {
  return <footer id="site-footer">
    <div className="footer-inner">
      <motion.section className="footer-invitation" {...reveal} aria-labelledby="footer-invitation-title">
        <div>
          <span className="footer-eyebrow">A considered beginning</span>
          <h2 id="footer-invitation-title">Ayurveda, personally matched.</h2>
          <p>Discover approved Ayurvedic hospitals, understand their care, and request an appointment with confidence.</p>
        </div>
        <div className="footer-invitation-actions">
          <a href={ROUTES.consumer.home}>Search hospitals</a>
          <a href="#contact">Request guidance</a>
        </div>
      </motion.section>

      <div className="footer-directory">
        <motion.div className="footer-brand-column" {...reveal}>
          <a href="#hero" className="footer-mark" aria-label="Return to the Ayursarga home section">
            <span className="footer-logo-wrap">
              <Image src="/mainlogo.png" alt="" width={58} height={58} loading="eager" quality={90} sizes="58px" />
            </span>
            <span>Ayursarga</span>
          </a>
          <p>Helping people find suitable Ayurvedic hospital care across Kerala through clearer discovery and thoughtful guidance.</p>
          <div className="footer-contact">
            <span>Kerala, India</span>
            <a href="tel:+918086070680">+91 8086070680</a>
            <a href="mailto:info@ayursarga.com">info@ayursarga.com</a>
          </div>
        </motion.div>

        <nav className="footer-column" aria-label="Explore Ayursarga">
          <h3>Explore</h3>
          <a href="#how-it-works">How it works</a>
          <a href="#wellness">Wellness paths</a>
          <a href="#why-ayursarga">Why Ayursarga</a>
          <a href="#contact">Personal guidance</a>
        </nav>

        <nav className="footer-column" aria-label="Consumer links">
          <h3>For consumers</h3>
          <a href={ROUTES.consumer.home}>Search hospitals</a>
          <a href={ROUTES.consumer.register}>Register</a>
          <a href={ROUTES.consumer.login}>Consumer login</a>
          <a href={ROUTES.consumer.bookings}>My bookings</a>
        </nav>

        <nav className="footer-column" aria-label="Hospital links">
          <h3>For hospitals</h3>
          <a href="#partners">Partner with Ayursarga</a>
          <a href={ROUTES.hospital.login}>Hospital login</a>
          <a href="#contact">Speak with our team</a>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Ayursarga. All rights reserved.</p>
        <p>Treatment suitability and clinical decisions are confirmed by the chosen hospital&apos;s qualified physician.</p>
        <a href="#hero">Back to top</a>
      </div>
    </div>
  </footer>;
}
