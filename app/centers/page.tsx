import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import PublicHospitalSearch from "@/components/PublicHospitalSearch";
import { normalizeCentreSearchContext } from "@/features/hospitals/searchContext";

export const metadata: Metadata = {
  title: "Explore Ayurvedic Centers | Ayursarga",
  description: "Search approved Ayurvedic centers, compare their active treatments and request an appointment through Ayursarga.",
};

type CentersPageProps = {
  searchParams: Promise<{
    service?: string | string[];
    startDate?: string | string[];
    endDate?: string | string[];
    q?: string | string[];
  }>;
};

export default async function CentersPage({ searchParams }: CentersPageProps) {
  const query = await searchParams;
  const requestedService = query.service;
  const service = typeof requestedService === "string" ? requestedService.trim().slice(0, 100) : "";
  const initialContext = normalizeCentreSearchContext(query);
  const initialSearch = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";

  return (
    <>
      <Nav sectionPrefix="/" solid />
      <main className="centers-directory-page">
        <PublicHospitalSearch initialService={service} initialContext={initialContext} initialSearch={initialSearch} />
      </main>
      <Footer sectionPrefix="/" />
    </>
  );
}
