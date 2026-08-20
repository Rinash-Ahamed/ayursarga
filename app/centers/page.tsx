import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import PublicHospitalSearch from "@/components/PublicHospitalSearch";
import PublicRouteEnvironment from "@/components/PublicRouteEnvironment";

export const metadata: Metadata = {
  title: "Explore Ayurvedic Centers | Ayursarga",
  description: "Search approved Ayurvedic centers, compare their active treatments and request an appointment through Ayursarga.",
};

export default function CentersPage() {
  return (
    <PublicRouteEnvironment>
      <Nav sectionPrefix="/" solid />
      <main className="centers-directory-page">
        <PublicHospitalSearch />
      </main>
      <Footer sectionPrefix="/" />
    </PublicRouteEnvironment>
  );
}
