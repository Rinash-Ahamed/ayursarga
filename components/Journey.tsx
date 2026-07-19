"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RevealLines, RevealWords } from "./Reveal";

const NEEDS = ["Prenatal care", "Postnatal care", "Baby care", "Lactation support", "Panchakarma", "Stress relief"];
const DETAILS: Record<string, string[]> = {
  "Prenatal care": ["Pregnancy yoga", "Dietary advice", "Pranayama & meditation", "Obstetric consultation"],
  "Postnatal care": ["Therapist support", "Doctor visits", "Dietary advice", "Family stay"],
  "Baby care": ["Baby massage", "Baby bath", "Paediatric consultation"],
  "Lactation support": ["Low milk supply", "Latching support", "Breast engorgement", "Online consultation"],
  Panchakarma: ["Doctor consultation", "Detox programme", "Rejuvenation therapy"],
  "Stress relief": ["Relaxation therapy", "Meditation", "Private stay", "Resort ambience"],
};

export default function Journey() {
  const [step, setStep] = useState(0);
  const [need, setNeed] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [district, setDistrict] = useState("Any district");
  const [budget, setBudget] = useState("Flexible");
  const toggle = (item: string) => setPreferences((current) => current.includes(item) ? current.filter((x) => x !== item) : [...current, item]);
  const restart = () => { setStep(0); setNeed(""); setPreferences([]); setDistrict("Any district"); setBudget("Flexible"); };

  return (
    <section id="matching" className="section dark-section match-section">
      <div className="section-inner match-layout">
        <div className="match-copy">
          <RevealWords text="Your Personal Match" className="eyebrow light" />
          <RevealLines as="h2" className="section-title light" lines={["The right care", "starts with", "the right questions."]} />
          <p>Take a minute to tell us what matters. We’ll use it to shape a thoughtful shortlist for you.</p>
          <div className="match-progress" aria-label={`Step ${Math.min(step + 1, 3)} of 3`}>{[0, 1, 2].map((n) => <span className={step >= n ? "active" : ""} key={n} />)}</div>
        </div>
        <div className="quiz-card"><AnimatePresence mode="wait">
          {step === 0 && <motion.div key="need" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <span className="quiz-kicker">Step 1 of 3</span><h3>What are you looking for?</h3>
            <div className="choice-grid">{NEEDS.map((item) => <button type="button" className={need === item ? "selected" : ""} onClick={() => setNeed(item)} key={item}>{item}</button>)}</div>
            <button type="button" className="quiz-next" disabled={!need} onClick={() => setStep(1)}>Continue <span>→</span></button>
          </motion.div>}
          {step === 1 && <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button type="button" className="quiz-back" onClick={() => setStep(0)}>← Back</button><span className="quiz-kicker">Step 2 of 3</span><h3>What should your stay include?</h3>
            <div className="choice-grid">{(DETAILS[need] || []).map((item) => <button type="button" className={preferences.includes(item) ? "selected" : ""} onClick={() => toggle(item)} key={item}>{item}</button>)}</div>
            <button type="button" className="quiz-next" onClick={() => setStep(2)}>Continue <span>→</span></button>
          </motion.div>}
          {step === 2 && <motion.div key="location" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button type="button" className="quiz-back" onClick={() => setStep(1)}>← Back</button><span className="quiz-kicker">Step 3 of 3</span><h3>Help us narrow the match.</h3>
            <label className="quiz-label">Preferred district<select value={district} onChange={(e) => setDistrict(e.target.value)}><option>Any district</option><option>Kochi / Ernakulam</option><option>Thiruvananthapuram</option><option>Kozhikode</option><option>Thrissur</option><option>Wayanad</option><option>Other</option></select></label>
            <label className="quiz-label">Budget preference<select value={budget} onChange={(e) => setBudget(e.target.value)}><option>Flexible</option><option>Essential comfort</option><option>Premium stay</option><option>Luxury retreat</option></select></label>
            <button type="button" className="quiz-next" onClick={() => setStep(3)}>Show my matches <span>→</span></button>
          </motion.div>}
          {step === 3 && <motion.div className="quiz-result" key="result" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="result-mark">✓</span><span className="quiz-kicker">Your profile is ready</span><h3>We’ll find your best {need.toLowerCase()} retreats.</h3>
            <p>{district} · {budget}{preferences.length ? ` · ${preferences.length} care preferences` : ""}</p>
            <a href="#contact" className="quiz-next">Get my personal shortlist <span>→</span></a><button type="button" className="restart-link" onClick={restart}>Start again</button>
          </motion.div>}
        </AnimatePresence></div>
      </div>
    </section>
  );
}
