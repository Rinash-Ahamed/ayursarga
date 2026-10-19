import { createRoot } from "react-dom/client";
import { PublicCentreComparison } from "@/components/PublicCentreComparison";
import { comparisonCalls } from "./comparisonMocks";
declare global { interface Window { comparisonCalls: string[]; } }
window.comparisonCalls = comparisonCalls;
createRoot(document.getElementById("fixture-root")!).render(<PublicCentreComparison detailQuery="" />);
