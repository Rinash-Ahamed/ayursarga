import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Who We Are | Ayursarga",
  description: "Learn how Ayursarga connects mothers, families and wellness seekers with trusted Ayurvedic care through one convenient digital platform.",
};

const CARE_OPTIONS = [
  "Ayurvedic postnatal care",
  "Prenatal wellness",
  "Mother and baby care",
  "Lactation support",
  "Pregnancy yoga and wellness",
  "Women’s wellness",
  "Ayurvedic therapies",
  "Wellness retreats",
  "Online consultations",
] as const;

export default function WhoWeArePage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="who-we-are-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">About Ayursarga</span>
          <h1>Who we are</h1>
          <p>Connecting families with trusted Ayurvedic care.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-highlight" aria-label="About Ayursarga">
          <strong>Ayursarga is a digital platform designed to make Ayurvedic prenatal, postnatal and wellness care easier to discover, explore and access.</strong>
        </section>

        <section className="discover-care-introduction" aria-labelledby="who-we-are-introduction">
          <div className="discover-care-heading">
            <span>A connected care ecosystem</span>
            <h2 id="who-we-are-introduction">More choice, brought together with clarity</h2>
          </div>
          <div className="discover-care-copy">
            <p>We connect mothers, families and wellness seekers with a network of selected Ayurvedic postnatal centres, wellness centres and qualified professionals across different locations.</p>
            <p>Instead of limiting families to one centre or one location, Ayursarga brings multiple care options together on one platform. Users can explore available services, packages, facilities, pricing and other relevant information, then choose an option that best suits their needs.</p>
            <p>Ayursarga began with a simple idea: finding the right Ayurvedic care should be easier, more transparent and more convenient.</p>
          </div>
        </section>

        <section className="discover-care-wellness" aria-labelledby="what-we-offer-title">
          <div className="discover-care-section-title">
            <span>What we offer</span>
            <h2 id="what-we-offer-title">Care options for different stages of life</h2>
            <p>Through our growing network, users can explore:</p>
          </div>
          <ul className="discover-care-check-grid">
            {CARE_OPTIONS.map((item) => <li key={item}><span aria-hidden="true">✓</span><p>{item}</p></li>)}
          </ul>
        </section>

        <section className="discover-care-ayursarga" aria-labelledby="traditional-care-modern-access">
          <span className="eyebrow light">Traditional care, modern access</span>
          <h2 id="traditional-care-modern-access">A simpler way to understand your options.</h2>
          <p>Ayursarga combines the traditional principles of Ayurveda with the convenience of a modern digital platform.</p>
          <p>Families should not need to spend hours searching for suitable centres, contacting multiple places and comparing packages individually. Our aim is to bring relevant options together so the discovery and booking process becomes simpler.</p>
        </section>

        <aside className="discover-care-disclaimer">
          <p>Ayursarga is a platform that connects people with care providers. The actual care is provided by the respective partner centre or qualified professional.</p>
        </aside>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#who-we-are-top" />
  </>;
}
