import type { Metadata } from "next";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "Contact Ayursarga | Personal Ayurvedic Guidance",
  description: "Speak with Ayursarga about personal Ayurvedic guidance or becoming an approved hospital partner.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ interest?: string | string[] }> }) {
  const query = await searchParams;
  const initialInterest = query.interest === "partnership" ? "Ayurvedic hospital partnership" : "";

  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <main className="contact-page">
      <Contact initialInterest={initialInterest} />
    </main>
    <Footer sectionPrefix="/" backToTopHref="#contact" />
  </>;
}
