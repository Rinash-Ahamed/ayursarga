import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Prenatal Care | Ayursarga",
  description: "Learn about prenatal wellness, pregnancy yoga, breathing practices, nutrition guidance, birth preparation and professionally guided Ayurvedic care during pregnancy.",
};

const AYURVEDIC_PRENATAL_SUPPORT = [
  "Personalised diet and lifestyle guidance",
  "Gentle pregnancy yoga",
  "Breathing and relaxation practices",
  "Appropriate Ayurvedic wellness therapies",
  "Stress-management practices",
  "Preparation for the postpartum period",
] as const;

const PRENATAL_BENEFITS = [
  "Monitor their health during pregnancy",
  "Monitor the baby’s development",
  "Identify potential complications early",
  "Maintain appropriate nutrition and lifestyle",
  "Prepare physically and emotionally for childbirth",
  "Learn about breastfeeding and newborn care",
  "Prepare for the postnatal period",
  "Build confidence for the transition into motherhood",
] as const;

export default function PrenatalCarePage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="prenatal-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">Pregnancy wellness</span>
          <h1>Prenatal care</h1>
          <p>Nurturing the mother and baby throughout pregnancy.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="Prenatal care overview">
          <strong>Ayursarga connects expecting mothers with suitable prenatal wellness services, including pregnancy yoga, breathing practices, Ayurvedic lifestyle guidance, nutrition guidance, birth preparation and online consultations, according to individual needs and professional recommendations.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="prenatal-care-title">
          <div className="discover-care-heading">
            <span>Understanding prenatal care</span>
            <h2 id="prenatal-care-title">What is prenatal care?</h2>
          </div>
          <div className="discover-care-copy discover-care-prenatal-copy">
            <p>Prenatal care is about caring for the mother and baby throughout pregnancy—not only preparing for childbirth, but also preparing for a healthy and confident transition into motherhood.</p>
            <strong className="discover-care-lead">Nurturing the mother and baby throughout pregnancy</strong>
            <p>Pregnancy brings physical, emotional and lifestyle changes. Regular prenatal care helps monitor the mother&apos;s and baby&apos;s wellbeing, identify potential concerns early and prepare the mother for childbirth and the postpartum period.</p>
          </div>
        </section>

        <section className="discover-care-wellness" aria-labelledby="ayurvedic-prenatal-title">
          <div className="discover-care-section-title">
            <span>Individualised support</span>
            <h2 id="ayurvedic-prenatal-title">Ayurvedic prenatal wellness</h2>
            <p>Depending on the individual&apos;s needs and the advice of an appropriately qualified practitioner, Ayurvedic prenatal wellness may include:</p>
          </div>
          <ul className="discover-care-check-grid">
            {AYURVEDIC_PRENATAL_SUPPORT.map((item) => <li key={item}><span aria-hidden="true">✓</span><p>{item}</p></li>)}
          </ul>
          <div className="discover-care-caution">
            <strong>Not every Ayurvedic therapy or herbal preparation is suitable during pregnancy.</strong>
            <p>Any Ayurvedic medicine, treatment or therapy during pregnancy should be recommended by an appropriately qualified healthcare professional after considering the mother&apos;s individual condition.</p>
          </div>
        </section>

        <section className="discover-care-ayursarga discover-care-prenatal-benefits" aria-labelledby="prenatal-importance-title">
          <span className="eyebrow light">Care with purpose</span>
          <h2 id="prenatal-importance-title">Why is prenatal care important?</h2>
          <p>Prenatal care helps mothers:</p>
          <ul className="discover-care-dark-list">
            {PRENATAL_BENEFITS.map((item) => <li key={item}><span aria-hidden="true">✓</span><p>{item}</p></li>)}
          </ul>
        </section>

        <aside className="discover-care-disclaimer discover-care-disclaimer-strong">
          <p><strong>Disclaimer: Prenatal wellness services are complementary to, not a replacement for, routine medical antenatal care.</strong></p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#prenatal-top" />
  </>;
}
