import { createRoot } from "react-dom/client";
import PublicCentreDetails from "@/components/PublicCentreDetails";
createRoot(document.getElementById("fixture-root")!).render(<>
  <PublicCentreDetails hospitalId="alpha" searchContext={{ startDate: "2099-10-25", endDate: "", bystanders: 1 }} />
  {window.centreDetailsHold && <footer data-testid="detail-footer" style={{ minHeight: 240, padding: 24 }}>Footer boundary</footer>}
</>);
