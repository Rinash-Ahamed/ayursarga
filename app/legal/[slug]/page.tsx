import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import { getLegalDocument, isLegalSlug, LegalDocumentPage, LEGAL_SLUGS } from "@/components/legal/LegalDocumentPage";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const document = getLegalDocument(slug);
  return {
    title: `${document.title} | Ayursarga`,
    description: `Read the Ayursarga ${document.title}.`,
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  return <>
    <Nav sectionPrefix="/" solid />
    <WhatsAppBubble />
    <LegalDocumentPage slug={slug} />
    <Footer sectionPrefix="/" backToTopHref="#legal-page-top" />
  </>;
}
