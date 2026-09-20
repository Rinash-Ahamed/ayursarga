import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "How Ayursarga Works | Ayursarga",
  description: "See how Ayursarga helps families explore, compare and choose Ayurvedic care, submit a request and connect with a suitable partner centre.",
};

const CARE_TYPES = [
  "Postnatal care",
  "Prenatal care",
  "Baby care",
  "Lactation support",
  "Women’s wellness",
  "Ayurvedic wellness",
  "Online consultation",
] as const;

const CENTRE_INFORMATION = [
  "Package details",
  "Duration",
  "Price",
  "Facilities",
  "Services included",
  "Accommodation",
  "Wellness activities",
  "Location",
  "Important centre information",
  "Centre rules",
  "Available care options",
] as const;

const COMPARISON_POINTS = [
  "Care requirements",
  "Budget",
  "Preferred location",
  "Duration",
  "Facilities",
  "Type of accommodation",
  "Services required",
  "Personal preferences",
] as const;

const STEPS = [
  {
    title: "Explore",
    copy: "Start by selecting the type of care you are looking for. You can then explore available options based on your requirements and preferred location.",
    items: CARE_TYPES,
  },
  {
    title: "Discover suitable options",
    copy: "Ayursarga brings together practical information about partner centres and services, helping you understand what each option offers before making a decision.",
    items: CENTRE_INFORMATION,
  },
  {
    title: "Compare and choose",
    copy: "Consider the options that matter to you. The goal is to help families make an informed choice instead of simply selecting the first available centre.",
    items: COMPARISON_POINTS,
  },
  {
    title: "Submit your booking or enquiry",
    copy: "Once you have selected a suitable option, submit your appointment request or enquiry through Ayursarga.",
  },
  {
    title: "Confirmation and coordination",
    copy: "Ayursarga coordinates the request with the relevant partner centre. The centre confirms availability and applicable booking details, after which the customer receives the relevant information.",
  },
  {
    title: "Receive your care",
    copy: "The selected partner centre or qualified professional provides the actual service according to the confirmed package. Ayursarga remains the platform facilitating the connection and booking process.",
  },
  {
    title: "Support and feedback",
    copy: "Ayursarga can assist with booking-related communication and support. After the experience, users may also share feedback to help us continuously improve the platform and partner network.",
  },
] as const;

export default function HowAyursargaWorksPage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="how-ayursarga-works-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">A clear care journey</span>
          <h1>How Ayursarga works</h1>
          <p>Discover, compare, choose and connect.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="How Ayursarga works overview">
          <strong>Ayursarga is designed to make finding suitable Ayurvedic care simpler, clearer and more convenient.</strong>
        </section>

        <section className="discover-care-topics" aria-labelledby="ayursarga-journey-title">
          <div className="discover-care-section-title">
            <span>From discovery to care</span>
            <h2 id="ayursarga-journey-title">Seven considered steps</h2>
            <p>Each step helps you understand your options before connecting with a partner centre or qualified professional.</p>
          </div>
          <div className="discover-care-topic-grid">
            {STEPS.map((step, index) => <article className="discover-care-topic-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              {"items" in step && <ul>{step.items.map((item) => <li key={item}>{item}</li>)}</ul>}
            </article>)}
          </div>
        </section>

        <section className="discover-care-ayursarga" aria-labelledby="ayursarga-journey-summary">
          <span className="eyebrow light">Your journey through Ayursarga</span>
          <h2 id="ayursarga-journey-summary">Explore. Compare. Choose. Book. Confirm. Experience.</h2>
          <div className="discover-care-journey" aria-label="Ayursarga care journey">
            {["Explore", "Compare", "Choose", "Book", "Confirm", "Experience"].map((step, index) => <span key={step}>{step}{index < 5 && <b aria-hidden="true">→</b>}</span>)}
          </div>
        </section>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#how-ayursarga-works-top" />
  </>;
}
