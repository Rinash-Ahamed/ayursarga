"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AYU_GUIDE_TOPICS } from "@/features/consumers/ayuGuide";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { sendContactEnquiry } from "@/services/contact/contactClient";
import { ROUTES } from "@/config/routes";
import { EnquiryVerification } from "@/components/forms/EnquiryVerification";

export default function AyuBuddyPanel({ busy, onBusyChange, onNavigate }: {
  busy: boolean; onBusyChange: (busy: boolean) => void; onNavigate: () => void;
}) {
  const [topicId, setTopicId] = useState<string>(AYU_GUIDE_TOPICS[0].id);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [verificationReset, setVerificationReset] = useState(0);
  const submitting = useRef(false);
  const id = useId();
  const topic = AYU_GUIDE_TOPICS.find((item) => item.id === topicId) ?? AYU_GUIDE_TOPICS[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!turnstileToken) { setError("Please complete the security verification before sending."); return; }
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form).entries());
    submitting.current = true;
    onBusyChange(true);
    setError("");
    try {
      await sendContactEnquiry({
        ...fields, turnstileToken,
        interest: "I need personal guidance", guidanceProfile: "Enquiry sent through Ayu, the Ayursarga website guide.",
      }, "ayu");
      form.reset();
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not confirm your message was sent. Please email info@ayursarga.com.");
    } finally {
      setTurnstileToken("");
      setVerificationReset((value) => value + 1);
      submitting.current = false;
      onBusyChange(false);
    }
  }

  return <div className="ayu-buddy-content">
    <p className="ayu-buddy-intro">New here? I can help you find your way around Ayursarga. What would you like to know?</p>
    <div className="ayu-buddy-topics" aria-label="Ayu help topics">
      {AYU_GUIDE_TOPICS.map((item) => <button key={item.id} type="button" aria-pressed={!enquiryOpen && item.id === topic.id} disabled={busy} onClick={() => { setTopicId(item.id); setEnquiryOpen(false); }}>{item.title}</button>)}
    </div>
    {!enquiryOpen ? <>
      <section className="ayu-buddy-answer" aria-live="polite" aria-atomic="true">
        <h3>{topic.title}</h3><p>{topic.answer}</p>
        <Link href={topic.href} prefetch={false} onClick={onNavigate}>{topic.action}</Link>
      </section>
      <button type="button" className="ayu-buddy-primary" onClick={() => setEnquiryOpen(true)}>Send a question to our team</button>
      <p className="ayu-buddy-note">I&apos;m a guided website helper, not a live agent or medical adviser.</p>
    </> : <section className="ayu-buddy-enquiry" aria-labelledby={`${id}-enquiry`}>
      <h3 id={`${id}-enquiry`}>Let&apos;s ask the Ayursarga team</h3>
      {sent ? <div className="ayu-buddy-success" role="status">
        <h4>Your question has been submitted.</h4><p>The team can reply to the email address you provided.</p>
        <button type="button" className="ayu-buddy-secondary" onClick={() => { setSent(false); setError(""); }}>Send another question</button>
      </div> : <form onSubmit={submit} aria-busy={busy}>
        <p className="ayu-buddy-note">Please do not include medical reports or sensitive health details. This form is not monitored for emergencies.</p>
        <fieldset disabled={busy}>
          <label htmlFor={`${id}-name`}>Your name *<input id={`${id}-name`} name="name" autoComplete="name" maxLength={100} required /></label>
          <label htmlFor={`${id}-email`}>Email address *<input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={160} required /></label>
          <label htmlFor={`${id}-phone`}>Phone number *<PhoneInput id={`${id}-phone`} name="phone" autoComplete="tel" placeholder="10-digit phone number" required /></label>
          <label htmlFor={`${id}-message`}>Your question *<textarea id={`${id}-message`} name="message" rows={3} maxLength={3000} required /></label>
          <input className="hp-field" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        </fieldset>
        <EnquiryVerification source="ayu" resetKey={verificationReset} onToken={setTurnstileToken} />
        {error && <p className="ayu-buddy-error" role="alert">{error}</p>}
        <button type="submit" className="ayu-buddy-primary" disabled={busy || !turnstileToken}>{busy ? "Sending your question..." : "Send to Ayursarga"}</button>
        {busy && <p className="ayu-buddy-note" role="status">Please keep this window open while we confirm submission.</p>}
        <p className="ayu-buddy-note">Your details are used to respond to this enquiry. <Link href={ROUTES.public.privacyPolicy} prefetch={false} target="_blank" rel="noopener noreferrer">Privacy Policy</Link></p>
      </form>}
      <a className="ayu-buddy-direct" href="mailto:info@ayursarga.com">Email directly: info@ayursarga.com</a>
    </section>}
  </div>;
}
