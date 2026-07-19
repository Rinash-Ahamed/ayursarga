"use client";

import { FormEvent, useState } from "react";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  return <section id="contact" className="section"><div className="contact-glow" /><div className="section-inner contact-inner">
    <RevealWords text="Begin Here" className="eyebrow" />
    <RevealLines as="h2" className="section-title" lines={["Your ideal retreat", "starts with a", "conversation."]} />
    <FadeUp as="p" className="contact-sub">Tell us what you’re looking for. An Ayursarga guide will help you explore the right options with no pressure.</FadeUp>
    {sent ? <FadeUp className="form-success"><span>✓</span><h3>Thank you. Your journey has begun.</h3><p>We’ve received your request and will be in touch with the next steps.</p></FadeUp> : <FadeUp as="form" className="contact-form" delay={.1} onSubmit={submit}>
      <div className="form-row"><input name="name" aria-label="Your name" type="text" placeholder="Your name" required /><input name="phone" aria-label="Phone number" type="tel" placeholder="Phone number" required /></div>
      <select name="interest" aria-label="Care you are interested in" required defaultValue=""><option value="" disabled>I’m interested in…</option><option>Prenatal care</option><option>Postnatal care</option><option>Baby care</option><option>Lactation support</option><option>Panchakarma</option><option>Wellness retreat</option><option>Partnership</option></select>
      <textarea name="message" aria-label="How can we help" placeholder="Anything you’d like us to know?" rows={3} />
      <label className="privacy-note"><input type="checkbox" required /> I agree to be contacted about my request.</label>
      <button className="form-submit" type="submit">Request a consultation <span>→</span></button>
    </FadeUp>}
  </div></section>;
}
