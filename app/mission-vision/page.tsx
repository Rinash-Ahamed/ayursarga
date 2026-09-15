import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Mission & Vision | Ayursarga",
  description: "Learn how Ayursarga is making trusted Ayurvedic care easier to discover and building a connected wellness ecosystem.",
};

const MISSION_COMMITMENTS = [
  "Make Ayurvedic care easier to discover",
  "Connect mothers, families and wellness seekers with suitable care options",
  "Encourage informed and confident care decisions",
  "Support mothers through different stages of their wellness journey",
  "Help Ayurvedic centres and qualified professionals reach more people",
  "Bring traditional Ayurvedic wellness into a convenient digital environment",
  "Build a reliable and growing network of care providers",
] as const;

const VISION_OUTCOMES = [
  "Mothers can find care suited to their needs",
  "Families can understand their options and make informed choices",
  "Centres can connect with people seeking their services",
  "Qualified professionals can expand their reach and opportunities",
  "Ayurvedic wellness can reach more people through thoughtful technology",
] as const;

function PurposeList({ items }: { items: readonly string[] }) {
  return <ul className="purpose-list">
    {items.map((item) => <li key={item}>
      <span aria-hidden="true">✓</span>
      <p>{item}</p>
    </li>)}
  </ul>;
}

export default function MissionVisionPage() {
  return <>
    <Nav sectionPrefix="/" solid />
    <main className="purpose-page">
      <header id="purpose-top" className="purpose-hero">
        <div className="purpose-hero-inner">
          <span className="eyebrow">Our purpose</span>
          <h1>Mission &amp; Vision</h1>
          <p>Rooted in trusted Ayurvedic care. Connected through thoughtful technology.</p>
        </div>
      </header>

      <div className="purpose-content">
        <section className="purpose-section purpose-mission" aria-labelledby="mission-title">
          <div className="purpose-section-heading">
            <span>Our mission</span>
            <h2 id="mission-title">Making trusted Ayurvedic care more accessible</h2>
          </div>
          <div className="purpose-section-copy">
            <p>Our mission is to create a trusted digital ecosystem that connects mothers, families and wellness seekers with suitable Ayurvedic care, qualified professionals and wellness providers.</p>
            <p>Through clearer discovery and practical guidance, Ayursarga aims to:</p>
            <PurposeList items={MISSION_COMMITMENTS} />
            <blockquote>To make trusted Ayurvedic care accessible, discoverable and convenient through a connected digital ecosystem.</blockquote>
          </div>
        </section>

        <section className="purpose-section purpose-vision" aria-labelledby="vision-title">
          <div className="purpose-section-heading">
            <span>Our vision</span>
            <h2 id="vision-title">Building a connected Ayurvedic wellness ecosystem</h2>
          </div>
          <div className="purpose-section-copy">
            <p>Our vision is to build a trusted platform where people can easily discover, understand and connect with Ayurvedic care and wellness services across locations.</p>
            <p>We envision an ecosystem where:</p>
            <PurposeList items={VISION_OUTCOMES} />
            <p>As Ayursarga grows, we aim to bring together a wider network of postnatal care centres, Ayurvedic wellness centres, doctors and qualified professionals. This will create a seamless bridge between people seeking care and the providers equipped to support them.</p>
            <blockquote>To become a trusted digital ecosystem connecting people with quality Ayurvedic care and wellness experiences across regions.</blockquote>
          </div>
        </section>
      </div>
    </main>
    <Footer sectionPrefix="/" backToTopHref="#purpose-top" />
  </>;
}
