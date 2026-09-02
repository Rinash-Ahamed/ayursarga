"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { GuidanceProfile } from "@/lib/guidanceProfile";

const WELLNESS_PATHS = [
  {
    id: "prenatal-care",
    name: "Prenatal care",
    description: "Comprehensive care for mother and baby throughout pregnancy, with guidance and support for a healthy journey.",
    image: "/wellness/prenatal-care.jpg",
    question: "What services are you looking for?",
    hint: "",
    options: ["Pregnancy yoga", "Dietary advice", "Pranayama & meditation", "Doctor consultation"],
  },
  {
    id: "postnatal-care",
    name: "Postnatal care",
    description: "Restorative support after childbirth, helping the mother recover while nurturing the baby and family.",
    image: "/wellness/postnatal-care.jpeg",
    question: "What should your care experience include?",
    hint: "Select the support and stay preferences that are important to you.",
    options: ["Therapist support", "Doctor visits", "Dietary guidance", "Family stay"],
  },
  {
    id: "lactation-support",
    name: "Lactation support",
    description: "Dedicated lactation care for mother and baby, with guidance for confident and comfortable feeding.",
    image: "/wellness/lactation-support.jpg",
    question: "What are your concerns?",
    hint: "Choose all that apply. You can add a concern in your own words.",
    options: ["Low milk supply", "Latching difficulty", "Breast engorgement", "Others"],
  },
  {
    id: "rejuvenation",
    name: "Rejuvenation",
    description: "Doctor-guided restorative care designed around rest, renewal, and your individual wellbeing goals.",
    image: "/wellness/panchakarma.jpeg",
    question: "What should your care experience include?",
    hint: "Select the programme or stay preferences you would like us to consider.",
    options: ["Detox programme", "Private stay", "Panchakarma therapy"],
  },
  {
    id: "womens-wellness",
    name: "Women’s wellness",
    description: "Personalised Ayurvedic care supporting women’s health and wellbeing through different life stages.",
    image: "/wellness/womens-wellness.jpeg",
    question: "What would you like guidance with?",
    hint: "Select any concerns you would like to discuss. Clinical suitability is confirmed by a qualified physician.",
    options: ["Menstrual irregularities", "PCOD / PCOS", "Premenopausal concerns", "Uterine fibroids", "Infertility", "Others"],
  },
  {
    id: "stress-management",
    name: "Stress management",
    description: "Quiet stays, therapies, and practices designed to support rest and a calmer daily rhythm.",
    image: "/wellness/stress-management.jpeg",
    question: "What should your care experience include?",
    hint: "Choose the kinds of support you would like included in your request.",
    options: ["Yoga & relaxation therapies", "Pranayama & meditation", "Body therapies"],
  },
] as const;

const KERALA_DISTRICTS = [
  "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
  "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
] as const;

type WellnessPath = (typeof WELLNESS_PATHS)[number];
type GuideStep = 0 | 1 | 2;

const PRENATAL_CONSULTATIONS = [
  ["doctor", "Doctor", "Ayurvedic physician consultation"],
  ["dietitian", "Dietitian", "Pregnancy nutrition guidance"],
  ["yoga", "Yoga instructor", "Prenatal yoga guidance"],
] as const;

type ConsultationIconName = (typeof PRENATAL_CONSULTATIONS)[number][0] | "lactation";

function ConsultationIcon({ name }: { name: ConsultationIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "doctor" && <><circle cx="12" cy="7" r="3" /><path d="M5.5 21v-2.5a6.5 6.5 0 0 1 13 0V21M8 13.5v2a4 4 0 0 0 8 0v-2" /><path d="M18 12.5h2v3h-2m1-1.5v-3" /></>}
    {name === "dietitian" && <><circle cx="12" cy="7" r="3" /><path d="M5.5 21v-2.5a6.5 6.5 0 0 1 13 0V21" /><path d="M17 5c2.6 0 4 1.5 4 4-2.6 0-4-1.4-4-4Zm0 4c0 2-1 3.5-3 4" /></>}
    {name === "yoga" && <><circle cx="12" cy="5" r="2.5" /><path d="m5 10 4 2 3-2 3 2 4-2M12 10v5m0 0-4 6m4-6 4 6" /></>}
    {name === "lactation" && <><circle cx="12" cy="6.5" r="3" /><path d="M5.5 21v-2.5a6.5 6.5 0 0 1 13 0V21" /><path d="M16.5 11.5c2.4 0 3.8 1.3 4 3.7-2.5.2-4-1-4-3.7Zm0 3.7c-1.1 1-1.8 2.2-2 3.8" /></>}
  </svg>;
}

export default function WellnessGuide({ onProfileChange }: { onProfileChange: (profile: GuidanceProfile | null) => void }) {
  const guidePanelRef = useRef<HTMLDivElement>(null);
  const [selectedPath, setSelectedPath] = useState<WellnessPath | null>(null);
  const [step, setStep] = useState<GuideStep>(0);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [consultationType, setConsultationType] = useState("");
  const [otherConcern, setOtherConcern] = useState("");
  const [district, setDistrict] = useState("Any district");
  const [otherDistrict, setOtherDistrict] = useState("");
  const [budget, setBudget] = useState("Flexible");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [lastMenstrualPeriod, setLastMenstrualPeriod] = useState("");
  const [preferredAppointmentDate, setPreferredAppointmentDate] = useState("");
  const [preferredTimeSlot, setPreferredTimeSlot] = useState("");
  const reduceMotion = useReducedMotion();
  const selectedDistrict = district === "Other" ? otherDistrict.trim() : district;
  const resolvedPreferences = preferences.map((preference) => preference === "Others" ? `Other concern: ${otherConcern.trim()}` : preference);
  const transition = reduceMotion ? { duration: 0 } : { duration: .3, ease: [0.22, 1, 0.36, 1] as const };
  const hasValidPreferences = preferences.length > 0 && (!preferences.includes("Others") || Boolean(otherConcern.trim()));
  const hasValidPostnatalDetails = selectedPath?.id !== "postnatal-care"
    || Boolean(expectedDeliveryDate && lastMenstrualPeriod);
  const needsPreferredAppointmentDate = selectedPath?.id === "rejuvenation"
    || selectedPath?.id === "stress-management";
  const hasValidPreferredAppointmentDate = !needsPreferredAppointmentDate || Boolean(preferredAppointmentDate);
  const hasValidWomensAppointment = selectedPath?.id !== "womens-wellness"
    || Boolean(consultationType && preferredAppointmentDate && preferredTimeSlot);
  const earliestAppointmentDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!selectedPath) return;

    const frame = window.requestAnimationFrame(() => {
      const panel = guidePanelRef.current;
      if (!panel) return;
      const navigationHeight = document.getElementById("site-nav")?.getBoundingClientRect().height ?? 0;
      const top = window.scrollY + panel.getBoundingClientRect().top - navigationHeight - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedPath, reduceMotion]);

  function resetAnswers() {
    setStep(0);
    setPreferences([]);
    setConsultationType("");
    setOtherConcern("");
    setDistrict("Any district");
    setOtherDistrict("");
    setBudget("Flexible");
    setExpectedDeliveryDate("");
    setLastMenstrualPeriod("");
    setPreferredAppointmentDate("");
    setPreferredTimeSlot("");
    onProfileChange(null);
  }

  function selectPath(path: WellnessPath) {
    if (selectedPath?.id === path.id) return;
    setSelectedPath(path);
    resetAnswers();
  }

  function togglePreference(item: string) {
    setPreferences((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  function complete() {
    if (!selectedPath) return;
    if (!hasValidPostnatalDetails || !hasValidPreferredAppointmentDate || !hasValidWomensAppointment) return;
    if (district === "Other" && !otherDistrict.trim()) return;
    onProfileChange({
      wellnessPath: selectedPath.name,
      preferences: resolvedPreferences,
      district: selectedDistrict,
      budget,
      expectedDeliveryDate: selectedPath.id === "postnatal-care" ? expectedDeliveryDate : undefined,
      lastMenstrualPeriod: selectedPath.id === "postnatal-care" ? lastMenstrualPeriod : undefined,
      consultationProvider: selectedPath.id === "womens-wellness" ? consultationType : undefined,
      preferredAppointmentDate: selectedPath.id === "womens-wellness" || needsPreferredAppointmentDate
        ? preferredAppointmentDate
        : undefined,
      preferredTimeSlot: selectedPath.id === "womens-wellness" ? preferredTimeSlot : undefined,
    });
    setStep(2);
  }

  function restart() {
    setSelectedPath(null);
    resetAnswers();
  }

  return <section id="wellness" className="section dark-section match-section wellness-guide-section">
    <div className="section-inner wellness-guide-inner">
      <div className="wellness-guide-heading">
        <p className="eyebrow light">Wellness paths</p>
        <h2 className="section-title light static-section-title"><span>Choose a wellness path</span><span>that feels right.</span></h2>
        <p>Tell us what you&rsquo;re looking for, and we&rsquo;ll help you find the right care.</p>
      </div>

      <AnimatePresence initial={false}>
        {selectedPath && <motion.div
          ref={guidePanelRef}
          id="wellness-guidance"
          className="quiz-card wellness-guide-panel"
          role="region"
          aria-label={`${selectedPath.name} guidance questions`}
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={transition}
          key="wellness-guide-panel"
        >
          <div className="wellness-guide-panel-head">
            <div className="wellness-guide-selected-path">
              <span className="wellness-guide-selected-image"><Image src={selectedPath.image} alt="" fill sizes="58px" quality={75} /></span>
              <div><span>Selected wellness path</span><strong>{selectedPath.name}</strong></div>
            </div>
            <div className="wellness-guide-panel-actions">
              <button type="button" className="wellness-change-path" onClick={restart}>Change path</button>
              <div className="match-progress" aria-label={`Step ${Math.min(step + 1, 2)} of 2`}>
                {[0, 1].map((item) => <span className={step >= item ? "active" : ""} key={item} />)}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && <motion.div className="wellness-guide-step" key={`${selectedPath.id}-preferences`} initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
              <span className="quiz-kicker">Step 1 of 2</span>
              <h3>{selectedPath.question}</h3>
              {selectedPath.hint && <p className="quiz-hint">{selectedPath.hint}</p>}
              <div className="choice-grid">{selectedPath.options.map((item) => <button type="button" className={preferences.includes(item) ? "selected" : ""} aria-pressed={preferences.includes(item)} onClick={() => togglePreference(item)} key={item}>{item}</button>)}</div>
              {preferences.includes("Others") && <label className="quiz-label other-district-label quiz-other-concern">Tell us about your concern
                <input type="text" value={otherConcern} onChange={(event) => setOtherConcern(event.target.value)} placeholder="Type your concern" autoFocus required />
              </label>}
              <button type="button" className="quiz-next" disabled={!hasValidPreferences} onClick={() => setStep(1)}>Continue <span aria-hidden="true">→</span></button>
            </motion.div>}

            {step === 1 && selectedPath.id === "prenatal-care" && <motion.div className="wellness-guide-step prenatal-consultation-step" key="prenatal-consultation" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
              <button type="button" className="quiz-back" onClick={() => setStep(0)}>← Back</button>
              <span className="quiz-kicker">Step 2 of 2</span>
              <h3>Online consultation</h3>
              <div className="consultation-options" aria-label="Choose an online consultation professional">
                {PRENATAL_CONSULTATIONS.map(([id, title, description]) => <article
                  className={consultationType === id ? "selected" : ""}
                  key={id}
                >
                  <span className="consultation-option-icon"><ConsultationIcon name={id} /></span>
                  <strong>{title}</strong>
                  <span>{description}</span>
                  <button type="button" className="consultation-booking-button" disabled onClick={() => setConsultationType(id)}>Book an appointment</button>
                </article>)}
              </div>
              <p className="prenatal-booking-note">Verified online providers will appear here when consultation booking is activated.</p>
            </motion.div>}

            {step === 1 && selectedPath.id === "lactation-support" && <motion.div className="wellness-guide-step prenatal-consultation-step" key="lactation-consultation" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
              <button type="button" className="quiz-back" onClick={() => setStep(0)}>← Back</button>
              <span className="quiz-kicker">Step 2 of 2</span>
              <h3>Online consultation</h3>
              <div className="consultation-options consultation-options-single" aria-label="Online lactation consultation">
                <button
                  type="button"
                  className={consultationType === "lactation" ? "selected" : ""}
                  aria-pressed={consultationType === "lactation"}
                  onClick={() => setConsultationType("lactation")}
                >
                  <span className="consultation-option-icon"><ConsultationIcon name="lactation" /></span>
                  <strong>Lactation consultant</strong>
                  <span>Feeding, latching, and lactation guidance</span>
                </button>
              </div>
              <button type="button" className="quiz-next prenatal-booking-placeholder" disabled>
                Book an appointment <span aria-hidden="true">→</span>
              </button>
              <p className="prenatal-booking-note">Verified lactation consultants will appear here when online booking is activated.</p>
            </motion.div>}

            {step === 1 && selectedPath.id === "womens-wellness" && <motion.div className="wellness-guide-step prenatal-consultation-step" key="womens-wellness-consultation" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
              <button type="button" className="quiz-back" onClick={() => setStep(0)}>← Back</button>
              <span className="quiz-kicker">Step 2 of 2</span>
              <h3>Online consultation</h3>
              <div className="consultation-provider-grid" aria-label="Women’s wellness online consultation doctors">
                {["Dr. Shafna", "Dr. Mizreen"].map((doctor) => <article className={`consultation-provider-card${consultationType === doctor ? " selected" : ""}`} key={doctor}>
                  <span className="consultation-option-icon"><ConsultationIcon name="doctor" /></span>
                  <strong>{doctor}</strong>
                  <span>Women’s wellness consultation</span>
                  <button type="button" aria-pressed={consultationType === doctor} onClick={() => setConsultationType(doctor)}>
                    {consultationType === doctor ? "Selected" : "Book an appointment"}
                  </button>
                </article>)}
              </div>
              {consultationType && <div className="quiz-location-grid consultation-preference-fields">
                <label className="quiz-label">Preferred appointment date *
                  <input type="date" min={earliestAppointmentDate} value={preferredAppointmentDate} onChange={(event) => setPreferredAppointmentDate(event.target.value)} required />
                </label>
                <label className="quiz-label">Preferred time slot *
                  <select value={preferredTimeSlot} onChange={(event) => setPreferredTimeSlot(event.target.value)} required>
                    <option value="" disabled>Select a time slot</option>
                    <option>9:00 AM - 10:00 AM</option>
                    <option>10:30 AM - 11:30 AM</option>
                    <option>2:00 PM - 3:00 PM</option>
                    <option>4:00 PM - 5:00 PM</option>
                  </select>
                </label>
              </div>}
              <button type="button" className="quiz-next" disabled={!hasValidWomensAppointment} onClick={complete}>Prepare appointment request <span aria-hidden="true">→</span></button>
              <p className="prenatal-booking-note">Your preferred doctor, date, and time will be included in the request. Ayursarga will confirm final availability.</p>
            </motion.div>}

            {step === 1 && selectedPath.id !== "prenatal-care" && selectedPath.id !== "lactation-support" && selectedPath.id !== "womens-wellness" && <motion.div className="wellness-guide-step" key="location" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
              <button type="button" className="quiz-back" onClick={() => setStep(0)}>← Back</button>
              <span className="quiz-kicker">Step 2 of 2</span>
              <h3>Help us narrow the request.</h3>
              {selectedPath.id !== "postnatal-care" && <p className="quiz-hint">Share your location and stay preference so an Ayursarga guide can understand what may suit you.</p>}
              <div className="quiz-location-grid">
                {needsPreferredAppointmentDate && <label className="quiz-label">Preferred date *
                  <input type="date" min={earliestAppointmentDate} value={preferredAppointmentDate} onChange={(event) => setPreferredAppointmentDate(event.target.value)} required />
                </label>}
                {selectedPath.id === "postnatal-care" && <>
                  <label className="quiz-label">Expected delivery date *
                    <input type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} required />
                  </label>
                  <label className="quiz-label">Last menstrual period *
                    <input type="date" value={lastMenstrualPeriod} onChange={(event) => setLastMenstrualPeriod(event.target.value)} required />
                  </label>
                </>}
                <label className="quiz-label">Preferred district
                  <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                    <option>Any district</option>
                    <optgroup label="Kerala">{KERALA_DISTRICTS.map((name) => <option key={name}>{name}</option>)}</optgroup>
                    <option>Other</option>
                  </select>
                </label>
                <label className="quiz-label">Budget preference
                  <select value={budget} onChange={(event) => setBudget(event.target.value)}>
                    <option>Flexible</option><option>Essential comfort</option><option>Premium stay</option><option>Luxury retreat</option>
                  </select>
                </label>
              </div>
              {district === "Other" && <label className="quiz-label other-district-label">Enter your preferred district
                <input type="text" value={otherDistrict} onChange={(event) => setOtherDistrict(event.target.value)} placeholder="District name" autoFocus required />
              </label>}
              <button type="button" className="quiz-next" disabled={!hasValidPostnatalDetails || !hasValidPreferredAppointmentDate || (district === "Other" && !otherDistrict.trim())} onClick={complete}>Prepare my request <span aria-hidden="true">→</span></button>
            </motion.div>}

            {step === 2 && <motion.div className="quiz-result wellness-guide-result" key="result" initial={reduceMotion ? false : { opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
              <span className="result-mark" aria-hidden="true">✓</span>
              <span className="quiz-kicker">Your guidance request is ready</span>
              <h3>Share your preferences with Ayursarga.</h3>
              <strong>{selectedPath.name}</strong>
              {selectedPath.id === "postnatal-care" && <p>Expected delivery date: {expectedDeliveryDate} &middot; Last menstrual period: {lastMenstrualPeriod}</p>}
              {selectedPath.id === "womens-wellness" && <p>Preferred consultant: {consultationType} &middot; {preferredAppointmentDate} &middot; {preferredTimeSlot}</p>}
              {needsPreferredAppointmentDate && <p>Preferred date: {preferredAppointmentDate}</p>}
              <p>{resolvedPreferences.join(" / ")} · {selectedDistrict} · {budget}</p>
              <a href="#contact" className="quiz-next">Continue to contact form <span aria-hidden="true">→</span></a>
            </motion.div>}
          </AnimatePresence>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {(!selectedPath || step === 2) && <motion.div
          className="path-grid wellness-path-grid"
          aria-label="Choose a wellness path"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : .24 }}
          key="wellness-path-grid"
        >
          {WELLNESS_PATHS.map((path, index) => {
            const isSelected = selectedPath?.id === path.id;
            return <motion.button
              type="button"
              className={`path-card wellness-path-card${isSelected ? " selected" : ""}`}
              key={path.id}
              aria-pressed={isSelected}
              onClick={() => selectPath(path)}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: .35 }}
              transition={reduceMotion ? { duration: 0 } : { delay: (index % 3) * .06, duration: .65, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="path-card-media">
                <Image
                  src={path.image}
                  alt={`${path.name} Ayurvedic wellness care`}
                  fill
                  sizes="(max-width: 600px) calc(100vw - 44px), (max-width: 900px) 50vw, 33vw"
                  quality={82}
                  loading={path.id === "prenatal-care" || path.id === "rejuvenation" ? "eager" : "lazy"}
                />
              </span>
              <span className="path-card-copy">
                <span className="path-card-title">{path.name}</span>
                <span className="path-card-description">{path.description}</span>
                <span className="path-card-action">{isSelected ? "Path selected" : "Choose this path"}<span aria-hidden="true">{isSelected ? "✓" : "→"}</span></span>
              </span>
            </motion.button>;
          })}
        </motion.div>}
      </AnimatePresence>
    </div>
  </section>;
}
