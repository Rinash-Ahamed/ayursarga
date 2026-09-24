import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import PublicCentreDetails from "@/components/PublicCentreDetails";
import { normalizeCentreSearchContext } from "@/features/hospitals/searchContext";

export const metadata: Metadata = {
  title: "Ayurvedic Centre Details | Ayursarga",
  description: "Review an Ayursarga partner centre, its treatments, pricing, practical information, and centre guidelines.",
};

export default async function PublicCentreDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hospitalId: string }>;
  searchParams: Promise<{ service?: string | string[]; q?: string | string[]; startDate?: string | string[]; endDate?: string | string[] }>;
}) {
  const [{ hospitalId }, query] = await Promise.all([params, searchParams]);
  const requestedService = typeof query.service === "string" ? query.service.trim().slice(0, 100) : "";
  const searchTerm = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  return <>
    <Nav sectionPrefix="/" solid />
    <main className="centers-directory-page"><PublicCentreDetails hospitalId={hospitalId} searchContext={normalizeCentreSearchContext(query)} initialService={requestedService} searchTerm={searchTerm} /></main>
    <Footer sectionPrefix="/" />
  </>;
}
