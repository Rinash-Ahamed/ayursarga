"use client";

import { FormEvent, useEffect, useState } from "react";
import { FadeUp, RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";

type FormStatus = "idle" | "sending" | "sent" | "error";

export default function Contact() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [interest, setInterest] = useState("");
  const isPartnership = interest === "Ayurvedic hospital partnership";

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
      const response = await fetch("/api/contact", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
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
    <RevealWords text="Personal guidance" className="eyebrow" /><RevealLines as="h2" className="section-title" lines={isPartnership ? ["Bring your care", "to more people."] : ["Talk with an", "Ayursarga guide."]} />
    <FadeUp as="p" className="contact-sub">{isPartnership ? "Tell us about your hospital, services, location, and the care you would like to offer. Our team will explain review, agreement, activation, and service listing." : "Tell us what you're looking for. An Ayursarga guide will help you explore suitable options before you request an appointment."}</FadeUp>
    {status === "sent" ? <FadeUp className="form-success"><span>&#10003;</span><h3>{isPartnership ? "Your partnership enquiry is on its way." : "Thank you. Your journey has begun."}</h3><p>{isPartnership ? "Our team will review your hospital details and contact you about approval and onboarding. Appointment requests begin after activation." : "Your request has been delivered to info@ayursarga.com."}</p></FadeUp> : <FadeUp as="form" className="contact-form" delay={.1} onSubmit={submit}>
      <div className="contact-form-heading"><h3>{isPartnership ? "Reach our partnerships team" : "Reach Ayursarga"}</h3><p>Share your details below and our team will contact you about your request.</p></div>
      <div className="form-row"><input name="name" aria-label="Your name" type="text" placeholder="Your name" required /><input name="phone" aria-label="Phone number" type="tel" placeholder="Phone number" required /></div>
      <input name="email" aria-label="Email address" type="email" placeholder="Email address" required />
      <select name="interest" aria-label="Care you are interested in" required value={interest} onChange={(event) => setInterest(event.target.value)}>
        <option value="" disabled>I&apos;m interested in...</option>
        <option>Ayurvedic hospital partnership</option>
        <optgroup label="Wellness paths">
          <option>Postnatal recovery</option>
          <option>Panchakarma</option>
          <option>Stress management</option>
          <option>Weight management</option>
          <option>PCOS care</option>
          <option>Women&apos;s wellness</option>
          <option>Corporate wellness</option>
          <option>Couples retreat</option>
          <option>Detox retreat</option>
        </optgroup>
        <optgroup label="More ways we can help">
          <option>Prenatal and maternity care</option>
          <option>Baby care and lactation support</option>
          <option>I need personal guidance</option>
        </optgroup>
      </select>
      <textarea name="message" aria-label="How can we help" placeholder={isPartnership ? "Hospital name, location, services, specialties, and how we can reach you" : "Anything you'd like us to know?"} rows={3} />
      <input className="hp-field" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {status === "error" && <p className="form-error" role="alert">We couldn&apos;t send your request. Please try again or email info@ayursarga.com.</p>}
      <MagneticButton className="form-submit btn-magnetic btn-primary" type="submit" disabled={status === "sending"}>
        <span className="submit-label">{status === "sending" ? "Sending..." : isPartnership ? "Send partnership enquiry" : "Request personal guidance"}</span>
        <span className="submit-arrow" aria-hidden="true">&rarr;</span>
      </MagneticButton>
    </FadeUp>}
  </div></section>;
}
