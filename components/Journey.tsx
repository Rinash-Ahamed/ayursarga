"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RevealLines, RevealWords } from "./Reveal";
import type { GuidanceProfile } from "@/lib/guidanceProfile";

const STAY_OPTIONS = [
  "Dietary guidance",
  "Doctor consultation",
  "Therapist support",
  "Pregnancy yoga",
  "Baby care support",
  "Latching difficulty",
  "Meditation & pranayama",
  "Detox programme",
  "Rejuvenation therapy",
  "Family stay",
  "Private stay",
  "Others",
] as const;

const KERALA_DISTRICTS = [
  "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
  "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
] as const;

export default function Journey({ onComplete }: { onComplete?: (profile: GuidanceProfile) => void }) {
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [otherConcern, setOtherConcern] = useState("");
  const [district, setDistrict] = useState("Any district");
  const [otherDistrict, setOtherDistrict] = useState("");
  const [budget, setBudget] = useState("Flexible");
  const reduceMotion = useReducedMotion();
  const selectedDistrict = district === "Other" ? otherDistrict.trim() : district;
  const resolvedPreferences = preferences.map((preference) => preference === "Others" ? `Other concern: ${otherConcern.trim()}` : preference);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  const togglePreference = (item: string) => {
    setPreferences((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  };

  const complete = () => {
    onComplete?.({ preferences: resolvedPreferences, district: selectedDistrict, budget });
    setStep(2);
  };

  const restart = () => {
    setStep(0);
    setPreferences([]);
    setOtherConcern("");
    setDistrict("Any district");
    setOtherDistrict("");
    setBudget("Flexible");
  };

  return <section id="matching" className="section dark-section match-section">
    <div className="section-inner match-layout">
      <div className="match-copy">
        <RevealWords text="Help me choose" className="eyebrow light" />
        <RevealLines as="h2" className="section-title light" lines={["A clearer path", "to suitable care."]} />
        <p>Tell us what would make your stay comfortable, then narrow the search by location and budget. An Ayursarga guide can help with the next step.</p>
        <div className="match-progress" aria-label={`Step ${Math.min(step + 1, 2)} of 2`}>
          {[0, 1].map((item) => <span className={step >= item ? "active" : ""} key={item} />)}
        </div>
      </div>

      <div className="quiz-card"><AnimatePresence mode="wait">
        {step === 0 && <motion.div key="preferences" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
          <span className="quiz-kicker">Step 1 of 2</span>
          <h3>What are your concerns?</h3>
          <p className="quiz-hint">Select any concerns that matter to you. You may also continue without choosing one.</p>
          <div className="choice-grid">{STAY_OPTIONS.map((item) => <button type="button" className={preferences.includes(item) ? "selected" : ""} aria-pressed={preferences.includes(item)} onClick={() => togglePreference(item)} key={item}>{item}</button>)}</div>
          {preferences.includes("Others") && <label className="quiz-label other-district-label quiz-other-concern">Tell us about your concern
            <input type="text" value={otherConcern} onChange={(event) => setOtherConcern(event.target.value)} placeholder="Type your concern" autoFocus required />
          </label>}
          <button type="button" className="quiz-next" disabled={preferences.includes("Others") && !otherConcern.trim()} onClick={() => setStep(1)}>Continue <span aria-hidden="true">&rarr;</span></button>
        </motion.div>}

        {step === 1 && <motion.div key="location" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }} transition={transition}>
          <button type="button" className="quiz-back" onClick={() => setStep(0)}>&larr; Back</button>
          <span className="quiz-kicker">Step 2 of 2</span>
          <h3>Help us narrow the match.</h3>
          <label className="quiz-label">Preferred district
            <select value={district} onChange={(event) => setDistrict(event.target.value)}>
              <option>Any district</option>
              <optgroup label="Kerala">{KERALA_DISTRICTS.map((name) => <option key={name}>{name}</option>)}</optgroup>
              <option>Other</option>
            </select>
          </label>
          {district === "Other" && <label className="quiz-label other-district-label">Enter your preferred district
            <input type="text" value={otherDistrict} onChange={(event) => setOtherDistrict(event.target.value)} placeholder="District name" autoFocus required />
          </label>}
          <label className="quiz-label">Budget preference
            <select value={budget} onChange={(event) => setBudget(event.target.value)}>
              <option>Flexible</option><option>Essential comfort</option><option>Premium stay</option><option>Luxury retreat</option>
            </select>
          </label>
          <button type="button" className="quiz-next" disabled={district === "Other" && !otherDistrict.trim()} onClick={complete}>Prepare my request <span aria-hidden="true">&rarr;</span></button>
        </motion.div>}

        {step === 2 && <motion.div className="quiz-result" key="result" initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
          <span className="result-mark" aria-hidden="true">&#10003;</span>
          <span className="quiz-kicker">Your preferences are ready</span>
          <h3>Share them with Ayursarga for personal guidance.</h3>
          <p>{selectedDistrict} / {budget}{resolvedPreferences.length ? ` / ${resolvedPreferences.length} care preferences` : ""}</p>
          <a href="#contact" className="quiz-next">Request personal guidance <span aria-hidden="true">&rarr;</span></a>
          <button type="button" className="restart-link" onClick={restart}>Start again</button>
        </motion.div>}
      </AnimatePresence></div>
    </div>
  </section>;
}
