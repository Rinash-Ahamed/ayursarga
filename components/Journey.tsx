"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RevealLines, RevealWords } from "./Reveal";
import MagneticButton from "./MagneticButton";
import type { MatchProfile } from "@/lib/matchProfile";

const NEEDS = ["Prenatal care", "Postnatal care", "Baby care", "Lactation support", "Panchakarma", "Stress relief"];
const DETAILS: Record<string, string[]> = {
  "Prenatal care": ["Pregnancy yoga", "Dietary advice", "Pranayama & meditation", "Obstetric consultation"],
  "Postnatal care": ["Therapist support", "Doctor visits", "Dietary advice", "Family stay"],
  "Baby care": ["Baby massage", "Baby bath", "Paediatric consultation"],
  "Lactation support": ["Low milk supply", "Latching support", "Breast engorgement", "Online consultation"],
  Panchakarma: ["Doctor consultation", "Detox programme", "Rejuvenation therapy"],
  "Stress relief": ["Relaxation therapy", "Meditation", "Private stay", "Resort ambience"],
};

const TAMIL_NADU_DISTRICTS = [
  "Ariyalur",
  "Chengalpattu",
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Kallakurichi",
  "Kancheepuram",
  "Kanyakumari",
  "Karur",
  "Krishnagiri",
  "Madurai",
  "Mayiladuthurai",
  "Nagapattinam",
  "Namakkal",
  "The Nilgiris",
  "Perambalur",
  "Pudukottai",
  "Ramanathapuram",
  "Ranipet",
  "Salem",
  "Sivaganga",
  "Tenkasi",
  "Thanjavur",
  "Theni",
  "Thiruvallur",
  "Thiruvarur",
  "Thoothukudi",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tirupathur",
  "Tiruppur",
  "Tiruvannamalai",
  "Vellore",
  "Viluppuram",
  "Virudhunagar",
] as const;

export default function Journey({ onComplete }: { onComplete?: (profile: MatchProfile) => void }) {
  const [step, setStep] = useState(0);
  const [needs, setNeeds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [district, setDistrict] = useState("Any district");
  const [otherDistrict, setOtherDistrict] = useState("");
  const [budget, setBudget] = useState("Flexible");
  const toggle = (item: string) => setPreferences((current) => current.includes(item) ? current.filter((x) => x !== item) : [...current, item]);
  const toggleNeed = (item: string) => setNeeds((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const detailOptions = Array.from(new Set(needs.flatMap((item) => DETAILS[item] || [])));
  const continueToDetails = () => {
    const available = new Set(detailOptions);
    setPreferences((current) => current.filter((item) => available.has(item)));
    setStep(1);
  };
  const selectedDistrict = district === "Other" ? otherDistrict.trim() : district;
  const captureProfile = () => onComplete?.({
    needs,
    preferences,
    district: selectedDistrict,
    budget,
  });
  const restart = () => { setStep(0); setNeeds([]); setPreferences([]); setDistrict("Any district"); setOtherDistrict(""); setBudget("Flexible"); };

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
            <span className="quiz-kicker">Step 1 of 3</span><h3>What are you looking for?</h3><p className="quiz-hint">Choose one or more care goals.</p>
            <div className="choice-grid">{NEEDS.map((item) => <MagneticButton type="button" className={needs.includes(item) ? "selected" : ""} onClick={() => toggleNeed(item)} key={item}>{item}</MagneticButton>)}</div>
            <MagneticButton type="button" className="quiz-next" disabled={!needs.length} onClick={continueToDetails}>Continue <span>→</span></MagneticButton>
          </motion.div>}
          {step === 1 && <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <MagneticButton type="button" className="quiz-back" onClick={() => setStep(0)}>← Back</MagneticButton><span className="quiz-kicker">Step 2 of 3</span><h3>What should your stay include?</h3>
            <div className="choice-grid">{detailOptions.map((item) => <MagneticButton type="button" className={preferences.includes(item) ? "selected" : ""} onClick={() => toggle(item)} key={item}>{item}</MagneticButton>)}</div>
            <MagneticButton type="button" className="quiz-next" onClick={() => setStep(2)}>Continue <span>→</span></MagneticButton>
          </motion.div>}
          {step === 2 && <motion.div key="location" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <MagneticButton type="button" className="quiz-back" onClick={() => setStep(1)}>← Back</MagneticButton><span className="quiz-kicker">Step 3 of 3</span><h3>Help us narrow the match.</h3>
            <label className="quiz-label">Preferred district<select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option>Any district</option>
              <optgroup label="Tamil Nadu">
                {TAMIL_NADU_DISTRICTS.map((name) => <option key={name}>{name}</option>)}
              </optgroup>
              <optgroup label="Kerala">
                <option>Kochi / Ernakulam</option>
                <option>Thiruvananthapuram</option>
                <option>Kozhikode</option>
                <option>Thrissur</option>
                <option>Wayanad</option>
              </optgroup>
              <option>Other</option>
            </select></label>
            {district === "Other" && <label className="quiz-label other-district-label">Enter your preferred district
              <input type="text" value={otherDistrict} onChange={(event) => setOtherDistrict(event.target.value)} placeholder="District name" autoFocus required />
            </label>}
            <label className="quiz-label">Budget preference<select value={budget} onChange={(e) => setBudget(e.target.value)}><option>Flexible</option><option>Essential comfort</option><option>Premium stay</option><option>Luxury retreat</option></select></label>
            <MagneticButton type="button" className="quiz-next" disabled={district === "Other" && !otherDistrict.trim()} onClick={() => setStep(3)}>Show my matches <span>→</span></MagneticButton>
          </motion.div>}
          {step === 3 && <motion.div className="quiz-result" key="result" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="result-mark">✓</span><span className="quiz-kicker">Your profile is ready</span><h3>We’ll find retreats matched to your care goals.</h3>
            <p className="result-needs">{needs.join(" · ")}</p>
            <p>{selectedDistrict} · {budget}{preferences.length ? ` · ${preferences.length} care preferences` : ""}</p>
            <MagneticButton href="#contact" className="quiz-next" onClick={captureProfile}>Get my personal shortlist <span>→</span></MagneticButton><MagneticButton type="button" className="restart-link" onClick={restart}>Start again</MagneticButton>
          </motion.div>}
        </AnimatePresence></div>
      </div>
    </section>
  );
}
