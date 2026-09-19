import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = {
  title: "Postnatal Care | Ayursarga",
  description: "Understand postnatal recovery, nutrition, rest, breastfeeding support, emotional wellbeing and newborn care, and explore suitable Ayurvedic care through Ayursarga.",
};

const POSTNATAL_BENEFITS = [
  {
    title: "Supports recovery after childbirth",
    copy: "Pregnancy and childbirth place considerable physical demands on the body. Appropriate postnatal care can support the mother’s gradual recovery and help her adapt to the changes following delivery.",
  },
  {
    title: "Supports nutrition",
    copy: "Adequate nutrition and hydration are important during postpartum recovery, particularly for mothers who are breastfeeding. Individual dietary needs may vary depending on the mother’s health and medical requirements.",
  },
  {
    title: "Encourages adequate rest",
    copy: "New mothers often experience interrupted sleep and physical fatigue. A supportive postnatal environment can help mothers get adequate rest and recover gradually.",
  },
  {
    title: "Supports breastfeeding",
    copy: "Postnatal support can help mothers with breastfeeding education, positioning, attachment and common breastfeeding concerns. Professional lactation support can be especially helpful when difficulties arise.",
  },
  {
    title: "Supports emotional wellbeing",
    copy: "The postpartum period can bring significant emotional and lifestyle changes. A supportive family and care environment can help mothers feel more comfortable and confident during this transition.",
    note: "Persistent sadness, severe anxiety, confusion, thoughts of self-harm or thoughts of harming the baby require prompt professional medical attention.",
  },
  {
    title: "Supports mother–baby bonding",
    copy: "Postnatal care provides an opportunity for mothers and babies to spend time together in a comfortable and supportive environment while the mother learns to understand and respond to her baby’s needs.",
  },
  {
    title: "Encourages a gradual return to activity",
    copy: "Postpartum activity should be introduced gradually according to the mother’s recovery, type of delivery and medical advice. Appropriate movement, breathing practices and gentle exercises may be incorporated when suitable.",
  },
] as const;

const NEWBORN_GUIDANCE = [
  "Baby hygiene",
  "Feeding",
  "Sleep",
  "Cord care",
  "Safe handling",
  "Basic newborn care",
  "Recognising situations that require medical attention",
] as const;

export default function PostnatalCarePage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="postnatal-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">Mother and baby care</span>
          <h1>Postnatal care</h1>
          <p>A gentle beginning for the mother and baby.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="Postnatal care overview">
          <strong>Postnatal care is an important part of a mother&apos;s recovery after childbirth. It supports physical recovery, nutrition, rest, breastfeeding, emotional wellbeing and newborn care. Ayursarga connects mothers and families with suitable Ayurvedic postnatal care options, helping them discover, compare and choose services that meet their individual needs.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="gentle-beginning-title">
          <div className="discover-care-heading">
            <span>Understanding postnatal care</span>
            <h2 id="gentle-beginning-title">A gentle beginning for the mother and baby</h2>
          </div>
          <div className="discover-care-copy">
            <p>The postnatal period is an important phase of a woman&apos;s journey. After pregnancy and childbirth, the mother&apos;s body and mind go through significant changes while she adapts to the demands of caring for her newborn.</p>
            <p>Postnatal care focuses on supporting the mother&apos;s recovery, nutrition, rest, emotional wellbeing and overall wellness, while also supporting healthy newborn care and breastfeeding.</p>
            <p>At Ayursarga, we believe that caring for the mother after childbirth is just as important as caring for the baby.</p>
          </div>
        </section>

        <section className="discover-care-benefits" aria-labelledby="postnatal-benefits-title">
          <div className="discover-care-section-title">
            <span>Care with purpose</span>
            <h2 id="postnatal-benefits-title">Why is postnatal care important?</h2>
          </div>
          <div className="discover-care-benefit-grid">
            {POSTNATAL_BENEFITS.map((benefit, index) => <article key={benefit.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.copy}</p>
              {"note" in benefit && <p className="discover-care-urgent-note">{benefit.note}</p>}
            </article>)}
            <article className="discover-care-newborn-card">
              <span>08</span>
              <h3>Provides guidance for newborn care</h3>
              <p>New parents may need guidance regarding:</p>
              <ul>{NEWBORN_GUIDANCE.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          </div>
        </section>

        <section className="discover-care-ayursarga" aria-labelledby="care-through-ayursarga-title">
          <span className="eyebrow light">Care through Ayursarga</span>
          <h2 id="care-through-ayursarga-title">Explore care with greater clarity.</h2>
          <strong>Ayursarga helps mothers and families discover and connect with trusted Ayurvedic postnatal care options through our growing network of partner centres and wellness providers. Through the platform, mothers can explore different options based on their requirements, location, package, facilities and budget.</strong>
          <div className="discover-care-journey" aria-label="Ayursarga care journey">
            {['Explore', 'Compare', 'Choose', 'Book', 'Experience'].map((step, index) => <span key={step}>{step}{index < 4 && <b aria-hidden="true">→</b>}</span>)}
          </div>
          <p>The actual postnatal services are provided by the respective partner centre or qualified professional, according to the confirmed package and applicable terms.</p>
          <a href={`${ROUTES.public.centers}?service=Postnatal%20care`}>Explore postnatal care centres</a>
        </section>

        <aside className="discover-care-disclaimer">
          <p>This information is for general educational and wellness purposes and does not replace medical advice. Mothers and babies with medical concerns should consult an appropriately qualified healthcare professional.</p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#postnatal-top" />
  </>;
}
