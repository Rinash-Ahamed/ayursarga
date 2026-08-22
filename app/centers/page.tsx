import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import PublicHospitalSearch from "@/components/PublicHospitalSearch";

export const metadata: Metadata = {
  title: "Explore Ayurvedic Centers | Ayursarga",
  description: "Search approved Ayurvedic centers, compare their active treatments and request an appointment through Ayursarga.",
};

type CentersPageProps = {
  searchParams: Promise<{ service?: string | string[] }>;
};

export default async function CentersPage({ searchParams }: CentersPageProps) {
  const requestedService = (await searchParams).service;
  const service = typeof requestedService === "string" ? requestedService.trim().slice(0, 100) : "";

  return (
    <>
      <Nav sectionPrefix="/" solid />
      <main className="centers-directory-page">
        <PublicHospitalSearch initialService={service} />
      </main>
      <Footer sectionPrefix="/" />
    </>
  );
}
