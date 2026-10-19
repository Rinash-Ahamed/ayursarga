import { createRoot } from "react-dom/client";
import { AdminHospitalCapacity } from "@/components/admin/HospitalCapacity";
import { PortalToastViewport } from "@/components/portal/PortalToast";
import { counters } from "./portalPerformanceMocks";

declare global {
  interface Window { portalPerformanceCounters: typeof counters; }
}
window.portalPerformanceCounters = counters;
createRoot(document.getElementById("fixture-root")!).render(<>
  <AdminHospitalCapacity hospitalId="test-hospital" />
  <PortalToastViewport />
</>);
