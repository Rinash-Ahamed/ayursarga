import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Ayurvedic Wellness | Ayursarga",
  description: "Discover traditional Ayurvedic wellness, therapies, personalised guidance, rejuvenation, yoga, nutrition and wellness retreats through Ayursarga.",
};

const WELLNESS_AREAS = [
  {
    title: "Ayurvedic therapies",
    copy: "Ayurvedic wellness centres may offer a range of traditional therapies based on individual needs.",
    items: ["Abhyanga (Ayurvedic oil massage)", "Shirodhara", "Herbal therapies", "Relaxation therapies", "Rejuvenation programmes", "Other centre-specific Ayurvedic treatments"],
    note: "The therapies offered and their suitability may vary between individuals and centres.",
  },
  {
    title: "Personalised wellness guidance",
    copy: "Ayurveda recognises that each individual has different needs and lifestyle patterns. Appropriate professional guidance may include:",
    items: ["Daily-routine guidance", "Dietary guidance", "Lifestyle recommendations", "Sleep and rest practices", "Stress-management approaches", "Personalised wellness programmes"],
  },
  {
    title: "Rejuvenation and relaxation",
    copy: "Ayurvedic wellness programmes can provide an opportunity to step away from a busy routine and focus on rest and relaxation.",
    items: ["Ayurvedic massage", "Relaxation therapies", "Yoga", "Meditation", "Breathing practices", "Wellness activities", "Rest and rejuvenation"],
  },
  {
    title: "Yoga and mind–body wellness",
    copy: "Ayurveda and yoga share a holistic approach to wellbeing. Suitable programmes may incorporate:",
    items: ["Yoga", "Pranayama and breathing practices", "Meditation", "Mindfulness", "Gentle movement", "Relaxation techniques"],
    note: "These practices can support general physical and mental wellbeing when appropriately guided.",
  },
  {
    title: "Ayurvedic nutrition and lifestyle",
    copy: "Food and daily habits are important aspects of Ayurvedic wellness. Professional guidance may focus on:",
    items: ["Balanced eating", "Appropriate meal routines", "Hydration", "Healthy lifestyle habits", "Seasonal routines", "Individual wellness goals"],
    note: "Dietary recommendations should be personalised, particularly for people with medical conditions or specific nutritional requirements.",
  },
  {
    title: "Wellness retreats",
    copy: "Ayursarga can help users discover Ayurvedic wellness experiences offered by suitable wellness centres. A wellness retreat may combine:",
    items: ["Accommodation", "Ayurvedic therapies", "Yoga", "Meditation", "Healthy meals", "Nature-based relaxation", "Wellness activities"],
    note: "The facilities and services depend on the individual partner property.",
  },
] as const;

const WELLNESS_FOUNDATIONS = ["Lifestyle", "Nutrition", "Movement", "Rest", "Relaxation", "Self-care"] as const;

const DISCOVERY_FACTORS = [
  "Location",
  "Type of wellness programme",
  "Therapies offered",
  "Duration",
  "Facilities",
  "Accommodation",
  "Package",
  "Price",
] as const;

export default function AyurvedicWellnessPage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="ayurvedic-wellness-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">Traditional care, thoughtfully connected</span>
          <h1>Ayurvedic wellness</h1>
          <p>Discover traditional Ayurvedic wellness, made easier through a modern digital platform.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="Ayurvedic wellness overview">
          <strong>Ayurveda is a traditional system of holistic health that places importance on maintaining balance between the body, mind and lifestyle.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="ayurvedic-wellness-introduction-title">
          <div className="discover-care-heading">
            <span>A holistic approach</span>
            <h2 id="ayurvedic-wellness-introduction-title">Wellness for body, mind and daily life</h2>
          </div>
          <div className="discover-care-copy discover-care-prenatal-copy">
            <p>Ayurvedic wellness focuses not only on illness, but also on healthy routines, appropriate nutrition, relaxation, rejuvenation and overall wellbeing.</p>
            <p>At Ayursarga, we bring Ayurvedic wellness into a convenient digital platform, helping individuals discover suitable wellness centres, therapies and professional services in different locations.</p>
          </div>
        </section>

        <section className="discover-care-topics" aria-labelledby="ayurvedic-wellness-includes-title">
          <div className="discover-care-section-title">
            <span>Explore the possibilities</span>
            <h2 id="ayurvedic-wellness-includes-title">What does Ayurvedic wellness include?</h2>
          </div>
          <div className="discover-care-topic-grid">
            {WELLNESS_AREAS.map((area, index) => <article className="discover-care-topic-card" key={area.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{area.title}</h3>
              <p>{area.copy}</p>
              <ul>{area.items.map((item) => <li key={item}>{item}</li>)}</ul>
              {"note" in area && <p className="discover-care-topic-warning">{area.note}</p>}
            </article>)}
          </div>
        </section>

        <section className="discover-care-ayursarga discover-care-wellness-choice" aria-labelledby="why-ayurvedic-wellness-title">
          <span className="eyebrow light">A proactive approach</span>
          <h2 id="why-ayurvedic-wellness-title">Why choose Ayurvedic wellness?</h2>
          <p>Ayurvedic wellness encourages individuals to take a proactive approach to their wellbeing by paying attention to:</p>
          <div className="discover-care-foundations" aria-label="Foundations of Ayurvedic wellness">
            {WELLNESS_FOUNDATIONS.map((item, index) => <span key={item}>{item}{index < WELLNESS_FOUNDATIONS.length - 1 && <b aria-hidden="true">+</b>}</span>)}
          </div>
          <strong>It can provide an opportunity to slow down, reconnect with healthy routines and incorporate traditional wellness practices into modern life.</strong>
        </section>

        <section className="discover-care-network" aria-labelledby="ayurvedic-wellness-ayursarga-title">
          <span>Discover through Ayursarga</span>
          <h2 id="ayurvedic-wellness-ayursarga-title">Ayurvedic wellness through Ayursarga</h2>
          <p>Ayursarga connects individuals and families with suitable Ayurvedic wellness centres and qualified professionals through one convenient digital platform.</p>
          <p>Users can explore available options based on factors such as:</p>
          <ul className="discover-care-factor-grid">
            {DISCOVERY_FACTORS.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p>Our growing network allows users to discover different Ayurvedic wellness experiences rather than being limited to a single centre.</p>
          <div className="discover-care-journey discover-care-journey-light" aria-label="Ayursarga wellness journey">
            {['Explore', 'Compare', 'Choose', 'Connect', 'Experience'].map((step, index) => <span key={step}>{step}{index < 4 && <b aria-hidden="true">→</b>}</span>)}
          </div>
          <p>The actual therapies and wellness services are provided by the respective partner centre or qualified professional according to the selected package.</p>
        </section>

        <aside className="discover-care-disclaimer discover-care-disclaimer-strong">
          <p><strong>Disclaimer: Ayurvedic wellness services are intended to support general wellbeing and should not be considered a substitute for diagnosis or treatment of medical conditions. Therapeutic services should be undertaken under appropriate professional guidance.</strong></p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#ayurvedic-wellness-top" />
  </>;
}
