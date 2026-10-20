import { createRoot } from "react-dom/client";
import { PublicCentreComparison } from "@/components/PublicCentreComparison";
import { comparisonCalls, comparisonDetailCalls } from "./comparisonMocks";
declare global { interface Window { comparisonCalls: string[]; comparisonDetailCalls: string[]; } }
window.comparisonCalls = comparisonCalls;
window.comparisonDetailCalls = comparisonDetailCalls;
createRoot(document.getElementById("fixture-root")!).render(<PublicCentreComparison detailQuery="" />);
