import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Baby Care | Ayursarga",
  description: "Learn about gentle newborn hygiene, baby massage, feeding support, safe sleep, baby routines and parent education through Ayursarga.",
};

const BABY_CARE_AREAS = [
  {
    title: "Newborn hygiene",
    copy: "Gentle daily care helps maintain the baby’s comfort and cleanliness.",
    introduction: "This may include guidance on:",
    items: ["Bathing", "Skin care", "Nappy care", "Cord care", "Clothing", "Maintaining a comfortable environment"],
  },
  {
    title: "Baby massage",
    copy: "Gentle infant massage is traditionally used as part of baby-care routines and may provide an opportunity for soothing touch and bonding.",
    paragraphs: [
      "At Ayursarga partner centres, baby massage may be offered according to the baby’s age, condition and the centre’s protocols.",
      "Massage should be gentle and should not be performed when the baby is unwell or when there are medical concerns without appropriate professional advice.",
    ],
  },
  {
    title: "Feeding and breastfeeding support",
    copy: "Parents can receive guidance about:",
    items: ["Breastfeeding", "Feeding positions", "Feeding frequency", "Recognising feeding cues", "Burping", "General newborn feeding practices"],
    paragraphs: ["For breastfeeding difficulties, professional lactation support can be recommended."],
  },
  {
    title: "Safe sleep",
    copy: "Parents can learn about creating a safe sleeping environment for their baby, including appropriate sleeping positions and a safe sleep space.",
  },
  {
    title: "Baby comfort and routine",
    copy: "Newborns gradually develop their own patterns of feeding, sleeping and waking. Parents can learn to recognise their baby’s cues and establish gentle routines appropriate for the baby’s age.",
  },
  {
    title: "Parent education",
    copy: "Baby care is also about supporting the parents. Guidance may cover:",
    items: ["Handling the newborn", "Bathing", "Feeding", "Nappy changing", "Basic hygiene", "Understanding baby cues", "When to seek medical attention"],
  },
] as const;

const AYURVEDIC_PERSONALISATION = [
  "Baby’s age",
  "Birth history",
  "Current health",
  "Skin sensitivity",
  "Individual needs",
] as const;

const BABY_CARE_BENEFITS = [
  "Maintain appropriate hygiene",
  "Support feeding and breastfeeding",
  "Promote comfortable routines",
  "Encourage healthy parent–baby bonding",
  "Understand their baby’s needs",
  "Recognise warning signs that require medical attention",
  "Gain confidence in newborn care",
] as const;

export default function BabyCarePage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="baby-care-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">Early-life wellness</span>
          <h1>Baby care</h1>
          <p>Gentle care for your little one.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="Baby care overview">
          <strong>Baby care is about providing gentle, attentive and appropriate care during the early stages of life. Ayursarga connects parents with suitable baby-care and mother-and-baby wellness services, including newborn-care guidance, gentle massage and breastfeeding support, depending on the services offered by each partner centre.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="gentle-baby-care-title">
          <div className="discover-care-heading">
            <span>A supported beginning</span>
            <h2 id="gentle-baby-care-title">Gentle care for your little one</h2>
          </div>
          <div className="discover-care-copy discover-care-prenatal-copy">
            <p>The first few weeks and months of life are an important period of growth and adjustment for both the baby and the parents. Newborns need attentive, gentle and consistent care, while parents often need guidance and reassurance as they learn to understand their baby&apos;s needs.</p>
          </div>
        </section>

        <section className="discover-care-benefits" aria-labelledby="baby-care-includes-title">
          <div className="discover-care-section-title">
            <span>Everyday support</span>
            <h2 id="baby-care-includes-title">What does baby care include?</h2>
          </div>
          <div className="discover-care-benefit-grid discover-care-baby-grid">
            {BABY_CARE_AREAS.map((area, index) => <article key={area.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{area.title}</h3>
              <p>{area.copy}</p>
              {"introduction" in area && <p>{area.introduction}</p>}
              {"items" in area && <ul>{area.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              {"paragraphs" in area && area.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>)}
          </div>
        </section>

        <section className="discover-care-wellness discover-care-baby-ayurveda" aria-labelledby="ayurvedic-baby-care-title">
          <div className="discover-care-section-title">
            <span>Carefully personalised</span>
            <h2 id="ayurvedic-baby-care-title">Ayurvedic approach to baby care</h2>
            <p>Ayurveda has traditionally included gentle approaches to infant wellbeing. However, newborns are particularly sensitive, and not every Ayurvedic oil, herbal preparation or therapy is appropriate for every baby.</p>
          </div>
          <p className="discover-care-list-intro">Ayurvedic baby-care services should therefore be personalised according to:</p>
          <ul className="discover-care-check-grid">
            {AYURVEDIC_PERSONALISATION.map((item) => <li key={item}><span aria-hidden="true">✓</span><p>{item}</p></li>)}
          </ul>
          <div className="discover-care-caution">
            <strong>Newborn care requires appropriate professional guidance.</strong>
            <p>Any Ayurvedic medicine or internal herbal preparation for a baby should only be used under appropriate professional medical guidance.</p>
          </div>
        </section>

        <section className="discover-care-ayursarga discover-care-prenatal-benefits" aria-labelledby="baby-care-importance-title">
          <span className="eyebrow light">Care with confidence</span>
          <h2 id="baby-care-importance-title">Why is baby care important?</h2>
          <p>Good baby care helps parents:</p>
          <ul className="discover-care-dark-list">
            {BABY_CARE_BENEFITS.map((item) => <li key={item}><span aria-hidden="true">✓</span><p>{item}</p></li>)}
          </ul>
        </section>

        <section className="discover-care-network" aria-labelledby="baby-care-ayursarga-title">
          <span>Discover through Ayursarga</span>
          <h2 id="baby-care-ayursarga-title">Baby care at Ayursarga</h2>
          <p>Ayursarga helps parents discover suitable baby-care and mother-and-baby wellness services through our network of partner centres and professionals.</p>
          <p>Services may vary from one partner centre to another. Parents should review the individual centre&apos;s package, facilities and terms before booking.</p>
        </section>

        <aside className="discover-care-disclaimer discover-care-disclaimer-strong">
          <p><strong>Disclaimer: Baby-care wellness services should complement, not replace, routine newborn check-ups, vaccinations and medical care from a qualified paediatric healthcare professional.</strong></p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#baby-care-top" />
  </>;
}
