"use client";

import { FormEvent, useEffect, useState } from "react";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";

type FormStatus = "idle" | "sending" | "sent" | "error";

export default function Contact() {
  const [status, setStatus] = useState<FormStatus>("idle");
  useEffect(() => {
    if (status !== "sent") return;
    const timer = window.setTimeout(() => setStatus("idle"), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      if (!response.ok) throw new Error("Delivery failed");
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return <section id="contact" className="section"><div className="contact-glow" /><div className="section-inner contact-inner">
    <RevealWords text="Begin Here" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={["Your ideal retreat", "starts with a", "conversation."]} />
    <FadeUp as="p" className="contact-sub">Tell us what you&apos;re looking for. An Ayursarga guide will help you explore the right options with no pressure.</FadeUp>
    {status === "sent" ? <FadeUp className="form-success"><span>&#10003;</span><h3>Thank you. Your journey has begun.</h3><p>Your request has been delivered to info@ayursarga.com.</p></FadeUp> : <FadeUp as="form" className="contact-form" delay={.1} onSubmit={submit}>
      <div className="form-row"><input name="name" aria-label="Your name" type="text" placeholder="Your name" required /><input name="phone" aria-label="Phone number" type="tel" placeholder="Phone number" required /></div>
      <input name="email" aria-label="Email address" type="email" placeholder="Email address" required />
      <select name="interest" aria-label="Care you are interested in" required defaultValue=""><option value="" disabled>I&apos;m interested in...</option><option>Prenatal care</option><option>Postnatal care</option><option>Baby care</option><option>Lactation support</option><option>Panchakarma</option><option>Wellness retreat</option><option>Partnership</option></select>
      <textarea name="message" aria-label="How can we help" placeholder="Anything you&apos;d like us to know?" rows={3} />
      <input className="hp-field" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="privacy-note"><input name="consent" type="checkbox" required /> I agree to be contacted about my request.</label>
      {status === "error" && <p className="form-error" role="alert">We couldn&apos;t send your request. Please try again or email info@ayursarga.com.</p>}
      <button className="form-submit" type="submit" disabled={status === "sending"}><span className="submit-label">{status === "sending" ? "Sending..." : "Request a consultation"}</span><span className="submit-arrow" aria-hidden="true">&rarr;</span></button>
    </FadeUp>}
  </div></section>;
}
