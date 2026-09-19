import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Online Ayurvedic Consultation | Ayursarga",
  description: "Learn how Ayursarga online consultations connect individuals, mothers and families with selected professional Ayurvedic and wellness guidance.",
};

const CONSULTATION_AREAS = [
  {
    title: "Prenatal wellness",
    copy: "Expecting mothers may seek guidance regarding:",
    items: ["Pregnancy lifestyle", "Diet and nutrition", "Appropriate yoga and breathing practices", "Relaxation and stress management", "General Ayurvedic wellness during pregnancy", "Preparation for the postnatal period"],
    note: "Online consultation does not replace routine antenatal check-ups or emergency medical care.",
  },
  {
    title: "Lactation support",
    copy: "Mothers can seek professional guidance for selected breastfeeding and lactation concerns, including:",
    items: ["Breastfeeding practices", "Feeding positions", "Common breastfeeding difficulties", "General lactation guidance", "Follow-up support"],
  },
  {
    title: "Women’s wellness",
    copy: "Women can seek guidance related to selected wellness goals such as:",
    items: ["Lifestyle management", "Nutrition", "Stress management", "Healthy weight-management goals", "Gynaecological disorders", "General Ayurvedic wellness"],
  },
  {
    title: "Postnatal guidance",
    copy: "Selected online consultations may support mothers with:",
    items: ["Postnatal lifestyle", "Nutrition guidance", "Recovery-related wellness", "Breastfeeding support", "General mother-and-baby care guidance"],
    note: "Where there are medical symptoms or complications, appropriate in-person medical evaluation should be sought.",
  },
] as const;

const CONSULTATION_STEPS = [
  ["Select your service", "Choose the consultation category that matches your needs."],
  ["Select a convenient date and time", "Choose an available consultation slot displayed on the platform."],
  ["Provide basic information", "Enter the information required for the selected consultation so that the professional can understand your concern."],
  ["Make the booking", "Complete the applicable booking and payment process."],
  ["Attend your consultation", "Join the consultation through the method provided by Ayursarga."],
  ["Receive professional guidance", "The professional will discuss your concerns and provide appropriate guidance based on the information available during the consultation."],
  ["Follow up", "Where applicable, follow-up consultations can be scheduled through the platform."],
] as const;

const CONSULTATION_BENEFITS = [
  ["Convenience", "Access professional guidance without travelling to a centre."],
  ["Easy scheduling", "Choose a suitable available date and time according to the consultation schedule."],
  ["Personalised guidance", "The consultation allows the professional to understand your individual needs rather than relying only on general information."],
  ["Accessible support", "Useful for mothers, families and individuals who may find travelling difficult or prefer remote consultations."],
  ["Connected care", "Online consultation can complement Ayursarga’s wider ecosystem of prenatal, postnatal, women’s wellness and Ayurvedic wellness services."],
] as const;

export default function OnlineConsultationPage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="online-consultation-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">Professional guidance, thoughtfully connected</span>
          <h1>Online consultation</h1>
          <p>Professional Ayurvedic guidance, wherever you are.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="Online consultation overview">
          <strong>Ayursarga&apos;s online consultation service makes it easier for individuals to access professional guidance without needing to visit a centre in person.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="online-guidance-title">
          <div className="discover-care-heading">
            <span>Guidance from home</span>
            <h2 id="online-guidance-title">Professional support made more accessible</h2>
          </div>
          <div className="discover-care-copy discover-care-prenatal-copy">
            <p>Through our digital platform, users can connect with appropriately qualified healthcare and wellness professionals for selected Ayurvedic consultations according to their individual needs.</p>
            <p>Online consultation can be particularly convenient for mothers, expecting women and families who may prefer guidance from the comfort of their home.</p>
          </div>
        </section>

        <section className="discover-care-topics" aria-labelledby="consultation-topics-title">
          <div className="discover-care-section-title">
            <span>Selected consultation areas</span>
            <h2 id="consultation-topics-title">What can you consult about?</h2>
            <p>Depending on the professional and service selected, online consultations may include:</p>
          </div>
          <div className="discover-care-topic-grid">
            {CONSULTATION_AREAS.map((area, index) => <article className="discover-care-topic-card" key={area.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{area.title}</h3>
              <p>{area.copy}</p>
              <ul>{area.items.map((item) => <li key={item}>{item}</li>)}</ul>
              {"note" in area && <p className="discover-care-topic-warning">{area.note}</p>}
            </article>)}
          </div>
        </section>

        <section className="discover-consultation-process" aria-labelledby="consultation-process-title">
          <div className="discover-care-section-title">
            <span>A clear digital journey</span>
            <h2 id="consultation-process-title">How online consultation works</h2>
          </div>
          <ol className="discover-consultation-steps">
            {CONSULTATION_STEPS.map(([title, copy], index) => <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </li>)}
          </ol>
        </section>

        <section className="discover-care-ayursarga discover-consultation-benefits" aria-labelledby="why-online-consultation-title">
          <span className="eyebrow light">Connected professional support</span>
          <h2 id="why-online-consultation-title">Why choose Ayursarga online consultation?</h2>
          <div className="discover-consultation-benefit-grid">
            {CONSULTATION_BENEFITS.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <aside className="discover-care-important-note">
          <span>Important information</span>
          <p>Online consultation has certain limitations. A professional may recommend an in-person consultation, examination, investigation or referral when required.</p>
        </aside>

        <aside className="discover-care-disclaimer discover-care-disclaimer-strong">
          <p><strong>Disclaimer: Online consultation is not a substitute for emergency care, physical examination or necessary medical evaluation. The availability and scope of consultation may vary according to the professional and service selected.</strong></p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#online-consultation-top" />
  </>;
}
