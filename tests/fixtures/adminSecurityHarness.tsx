import { createRoot } from "react-dom/client";
import { AdminSecurity } from "@/components/admin/AdminSecurity";

createRoot(document.getElementById("fixture-root")!).render(<AdminSecurity enabled={(window as unknown as { recoveryEnabled?: boolean }).recoveryEnabled === true} />);
