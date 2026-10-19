import { createRoot } from "react-dom/client";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import { PortalToastViewport } from "@/components/portal/PortalToast";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { HospitalsManager } from "@/components/admin/HospitalsManager";
import { AdminHospitalDetails } from "@/components/admin/HospitalDetails";
import { ConsultantsManager } from "@/components/admin/ConsultantsManager";
import { UsersList } from "@/components/admin/UsersList";
import { AdminBookings } from "@/components/admin/AdminBookings";
import { AdminAvailability } from "@/components/admin/AdminAvailability";
import { AdminAuditLogs } from "@/components/admin/AdminAuditLogs";
import { HospitalDashboard } from "@/components/hospital/HospitalDashboard";
import { HospitalProfile } from "@/components/hospital/HospitalProfile";
import { ServicesManager } from "@/components/hospital/ServicesManager";
import { HospitalBookings } from "@/components/hospital/HospitalBookings";
import { HospitalAvailability } from "@/components/hospital/HospitalAvailability";
import { HospitalChangePasswordForm } from "@/components/hospital/ChangePasswordForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { portalUiState } from "./portalUiMocks";

declare global { interface Window { mountPortalUi: (screen: string) => void; unmountPortalUi?: () => void; } }
const screens = {
  "admin-dashboard": <AdminDashboard />, "admin-hospitals": <HospitalsManager />, "admin-details": <AdminHospitalDetails hospitalId="centre" />,
  "admin-consultants": <ConsultantsManager />, "admin-users": <UsersList />, "admin-bookings": <AdminBookings />,
  "admin-availability": <AdminAvailability />, "admin-audits": <AdminAuditLogs />,
  "hospital-dashboard": <HospitalDashboard />, "hospital-profile": <HospitalProfile />, "hospital-services": <ServicesManager />,
  "hospital-bookings": <HospitalBookings />, "hospital-availability": <HospitalAvailability />, "hospital-password": <HospitalChangePasswordForm />,
  "admin-login": <LoginForm role="admin" />, "hospital-login": <LoginForm role="hospital" />,
  "admin-forgot": <ForgotPasswordForm role="admin" />, "hospital-forgot": <ForgotPasswordForm role="hospital" />,
};
window.mountPortalUi = (screen) => {
  portalUiState.screen = screen;
  const root = createRoot(document.getElementById("fixture-root")!);
  window.unmountPortalUi = () => root.unmount();
  root.render(<PortalEnvironment area={screen.startsWith("hospital") ? "hospital" : "admin"}>{screens[screen as keyof typeof screens]}<PortalToastViewport /></PortalEnvironment>);
};
