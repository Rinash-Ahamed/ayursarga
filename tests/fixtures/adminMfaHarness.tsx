import { createRoot } from "react-dom/client";
import { LoginForm } from "@/components/auth/LoginForm";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import { PortalToastViewport } from "@/components/portal/PortalToast";

createRoot(document.getElementById("fixture-root")!).render(<PortalEnvironment area="admin"><PortalToastViewport /><LoginForm role="admin" /></PortalEnvironment>);
