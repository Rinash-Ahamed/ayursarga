import { createRoot } from "react-dom/client";
import PublicHospitalSearch from "@/components/PublicHospitalSearch";
createRoot(document.getElementById("fixture-root")!).render(<main className="centers-directory-page"><PublicHospitalSearch initialContext={{ startDate: "", endDate: "", bystanders: 1 }} /></main>);
