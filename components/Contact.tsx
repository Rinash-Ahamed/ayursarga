"use client";

import { FormEvent, useEffect, useState } from "react";
import { FadeUp } from "./Reveal";
import MagneticButton from "./MagneticButton";
import { clearGuidanceProfile, formatGuidanceProfile, loadGuidanceProfile, type GuidanceProfile } from "@/lib/guidanceProfile";

type FormStatus = "idle" | "sending" | "sent" | "error";

export default function Contact({ guidanceProfile = null, initialInterest = "" }: { guidanceProfile?: GuidanceProfile | null; initialInterest?: string }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [interest, setInterest] = useState(initialInterest);
  const [storedGuidanceProfile, setStoredGuidanceProfile] = useState<GuidanceProfile | null>(null);
  const activeGuidanceProfile = guidanceProfile ?? storedGuidanceProfile;
  const selectedInterest = interest || (activeGuidanceProfile ? "I need personal guidance" : "");
  const isPartnership = selectedInterest === "Ayurvedic hospital partnership";
  const displayedGuidanceProfile = isPartnership ? null : activeGuidanceProfile;
  const guidanceSummary = displayedGuidanceProfile ? formatGuidanceProfile(displayedGuidanceProfile) : "";

  useEffect(() => {
    if (!guidanceProfile && initialInterest !== "Ayurvedic hospital partnership") {
      setStoredGuidanceProfile(loadGuidanceProfile());
    }
  }, [guidanceProfile, initialInterest]);

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
      clearGuidanceProfile();
      setStoredGuidanceProfile(null);
      setStatus("sent");
    } catch {
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return <section id="contact" className="section contact-section"><div className="contact-glow" /><div className="section-inner contact-inner">
    <div className="contact-page-panel">
      <header className="contact-intro-panel">
        <p className="eyebrow light">{isPartnership ? "Hospital partnerships" : "Personal guidance"}</p>
        <h1 className="section-title light static-section-title">{isPartnership ? <><span>Bring your care</span><span>to more people.</span></> : <><span>Talk with an</span><span>Ayursarga guide.</span></>}</h1>
        <p className="contact-sub">{isPartnership ? "Tell us about your hospital, services, location, and the care you would like to offer. Our team will explain review, agreement, activation, and service listing." : "Tell us what you're looking for. An Ayursarga guide will help you explore suitable options before you request an appointment."}</p>

        <div className="contact-guidance-points" aria-label="What to expect">
          <div><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="m8 12 2.5 2.5L16.5 8" /></svg></span><p><strong>Thoughtful guidance</strong><small>A real conversation shaped around your request.</small></p></div>
          <div><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19.5V8l8-5 8 5v11.5" /><path d="M8 21v-8h8v8M3 21h18" /></svg></span><p><strong>Clear next steps</strong><small>Understand suitable options before moving forward.</small></p></div>
        </div>

        <div className="contact-direct">
          <span>Prefer to contact us directly?</span>
          <a href="tel:+918086070680"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 8.2 7.9 10a15.5 15.5 0 0 0 6.1 6.1l1.8-2.1 4.7 2.8-.8 3.1c-.2.7-.8 1.1-1.5 1.1C10.1 20.6 3.4 13.9 3 5.8c0-.7.4-1.3 1.1-1.5l3.1-.8Z" /></svg>+91 8086070680</a>
          <a href="mailto:info@ayursarga.com"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z" /><path d="m4 7 8 6 8-6" /></svg>info@ayursarga.com</a>
        </div>
      </header>

      <div className="contact-form-panel">
        <p className="contact-form-kicker">Start a conversation</p>
        <h2>{isPartnership ? "Introduce your centre." : "How can we help?"}</h2>
        <p className="contact-form-intro">Complete the details below and the Ayursarga team will respond to your request.</p>
        {status === "sent" ? <FadeUp className="form-success"><span>&#10003;</span><h3>{isPartnership ? "Your partnership enquiry is on its way." : "Thank you. Your journey has begun."}</h3><p>{isPartnership ? "Our team will review your hospital details and contact you about approval and onboarding. Appointment requests begin after activation." : "Your request has been delivered to info@ayursarga.com."}</p></FadeUp> : <form className="contact-form" onSubmit={submit}>
          <div className="form-row"><input name="name" aria-label="Your name" type="text" placeholder="Your name" required /><input name="phone" aria-label="Phone number" type="tel" placeholder="Phone number" required /></div>
          <input name="email" aria-label="Email address" type="email" placeholder="Email address" required />
          {displayedGuidanceProfile && <div className="captured-match" role="status">
            <span>Your guidance preferences</span>
            <strong>{displayedGuidanceProfile.wellnessPath}</strong>
            {displayedGuidanceProfile.expectedDeliveryDate && <p>Expected delivery date: {displayedGuidanceProfile.expectedDeliveryDate}</p>}
            {displayedGuidanceProfile.lastMenstrualPeriod && <p>Last menstrual period: {displayedGuidanceProfile.lastMenstrualPeriod}</p>}
            {displayedGuidanceProfile.consultationProvider && <p>Preferred consultant: {displayedGuidanceProfile.consultationProvider}</p>}
            {displayedGuidanceProfile.preferredAppointmentDate && <p>Preferred appointment date: {displayedGuidanceProfile.preferredAppointmentDate}</p>}
            {displayedGuidanceProfile.preferredTimeSlot && <p>Preferred time slot: {displayedGuidanceProfile.preferredTimeSlot}</p>}
            <p>{displayedGuidanceProfile.preferences.join(" / ")} &middot; {displayedGuidanceProfile.district} &middot; {displayedGuidanceProfile.budget}</p>
          </div>}
          <input type="hidden" name="guidanceProfile" value={guidanceSummary} />
          <select name="interest" aria-label="Care you are interested in" required value={selectedInterest} onChange={(event) => setInterest(event.target.value)}>
            <option value="" disabled>I&apos;m interested in...</option>
            <option>Ayurvedic hospital partnership</option>
            <optgroup label="Wellness paths">
              <option>Postnatal recovery</option>
              <option>Rejuvenation</option>
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
        </form>}
      </div>
    </div>
  </div></section>;
}
