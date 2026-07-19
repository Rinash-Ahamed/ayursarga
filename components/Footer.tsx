"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function Footer() {
  return <footer id="site-footer"><div className="footer-inner">
    <motion.div className="footer-mark" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .8 }} transition={{ duration: .8, ease: [0.22, 1, 0.36, 1] }}>
      <motion.div className="footer-logo-wrap" initial={{ scale: .55, rotate: -24 }} whileInView={{ scale: 1, rotate: 0 }} whileHover={{ scale: 1.08, rotate: 4 }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
        <Image src="/mainlogo.png" alt="Ayursarga" width={48} height={48} />
      </motion.div>
      <motion.span initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: .7, delay: .3 }}>Ayursarga</motion.span>
    </motion.div>
    <p>Kerala · Personalised Ayurvedic Retreat Matching</p>
    <div className="footer-links"><a href="#how-it-works">How it works</a><a href="#wellness">Wellness</a><a href="#partners">For partners</a><a href="#contact">Contact</a></div>
    <p className="footer-fine">© 2026 Ayursarga. Recommendations are personalised; treatment suitability is confirmed by the chosen centre’s physician.</p>
  </div></footer>;
}
