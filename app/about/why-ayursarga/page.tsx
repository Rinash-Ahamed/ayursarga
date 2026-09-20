import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Why Ayursarga | Ayursarga",
  description: "See how Ayursarga makes Ayurvedic postnatal and wellness care easier to discover, understand and access for mothers and families.",
};

const REASONS = [
  {
    title: "Multiple care options",
    copy: "Ayursarga brings different Ayurvedic care and wellness options together on one platform. Whether you are looking for postnatal care, pregnancy wellness, baby care or a wellness retreat, you can explore suitable options in one place.",
  },
  {
    title: "Convenience",
    copy: "Instead of contacting multiple centres individually, users can discover relevant information through the Ayursarga platform. Our goal is to make finding and enquiring about care simple and convenient.",
  },
  {
    title: "Choice",
    copy: "Every mother and family has different needs. Some may prefer a residential postnatal centre, while others may need care at home or online services. Ayursarga provides choice rather than a one-size-fits-all approach.",
  },
  {
    title: "Information before you decide",
    copy: "We aim to provide relevant information about available services, packages, facilities, pricing and centre-specific policies so users can make a more informed decision.",
  },
  {
    title: "A focus on mothers and families",
    copy: "Ayursarga is built around the needs of mothers and families. From pregnancy wellness to postnatal recovery, lactation support, baby care and women’s wellness, the platform focuses on services relevant to different stages of a woman’s journey.",
  },
  {
    title: "Ayurveda with modern convenience",
    copy: "Ayurveda has a rich tradition of holistic care. Ayursarga brings this traditional approach into a modern digital ecosystem, making Ayurvedic services easier to discover and access.",
  },
  {
    title: "A growing network",
    copy: "Ayursarga aims to build a network of suitable Ayurvedic centres, wellness centres and professionals across different regions, giving users access to more choices as the network grows.",
  },
  {
    title: "A partner-focused quality approach",
    copy: "Ayursarga aims to work with appropriate centres and professionals and collect relevant information before onboarding partners. Actual services are delivered by the respective partner, so users should review each centre’s information, terms and services before booking.",
  },
  {
    title: "Support throughout the booking journey",
    copy: "From exploring options and coordinating a booking request to post-booking assistance, Ayursarga aims to provide a smoother customer experience.",
  },
] as const;

export default function WhyAyursargaPage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="discover-care-page">
      <header id="why-ayursarga-page-top" className="discover-care-hero">
        <div className="discover-care-hero-inner">
          <span className="eyebrow">A considered way to find care</span>
          <h1>Why Ayursarga?</h1>
          <p>One platform. Multiple possibilities. Trusted Ayurvedic care.</p>
        </div>
      </header>

      <div className="discover-care-content">
        <section className="discover-care-introduction" aria-labelledby="simpler-care-journey">
          <div className="discover-care-heading">
            <span>Choosing with confidence</span>
            <h2 id="simpler-care-journey">Ayursarga simplifies the journey</h2>
          </div>
          <div className="discover-care-copy">
            <p>Choosing postnatal or wellness care is an important decision.</p>
            <p>Families often need to search across different centres, make multiple calls and compare services, facilities and prices before making a choice.</p>
            <p>Ayursarga brings those possibilities together so families can explore their options with greater clarity.</p>
          </div>
        </section>

        <section className="discover-care-topics" aria-labelledby="why-ayursarga-reasons">
          <div className="discover-care-section-title">
            <span>Designed around real needs</span>
            <h2 id="why-ayursarga-reasons">Nine reasons to begin with Ayursarga</h2>
          </div>
          <div className="discover-care-topic-grid">
            {REASONS.map((reason, index) => <article className="discover-care-topic-card" key={reason.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{reason.title}</h3>
              <p>{reason.copy}</p>
            </article>)}
          </div>
        </section>

        <section className="discover-care-ayursarga" aria-labelledby="why-ayursarga-promise">
          <span className="eyebrow light">Our aim</span>
          <h2 id="why-ayursarga-promise">Easier to discover. Easier to understand. Easier to access.</h2>
          <p>We aim to make Ayurvedic care easier to discover, easier to understand and easier to access.</p>
        </section>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#why-ayursarga-page-top" />
  </>;
}
