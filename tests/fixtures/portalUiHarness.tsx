import { createRoot } from "react-dom/client";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import { PortalToastViewport } from "@/components/portal/PortalToast";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminBilling } from "@/components/admin/AdminBilling";
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
import { PasswordActionForm } from "@/components/auth/PasswordActionForm";
import { GuestOnly } from "@/components/auth/RequireRole";
import { portalUiState } from "./portalUiMocks";
import { ConsumerBookings } from "@/components/consumer/ConsumerBookings";
import { BookingRequestForm } from "@/components/consumer/BookingRequestForm";
import { ConsumerProfile } from "@/components/consumer/ConsumerProfile";
import { ConsumerSupport } from "@/components/consumer/ConsumerSupport";
import { ConsultationBookingForm } from "@/components/consumer/ConsultationBookingForm";
import { ConsultationBookings } from "@/components/consultations/ConsultationBookings";

declare global { interface Window { mountPortalUi: (screen: string) => void; unmountPortalUi?: () => void; } }
const screens = {
  "admin-billing": <AdminBilling />,
  "password-action": <PasswordActionForm />,
  "admin-dashboard": <AdminDashboard />, "admin-hospitals": <HospitalsManager />, "admin-details": <AdminHospitalDetails hospitalId="centre" />,
  "admin-consultants": <ConsultantsManager />, "admin-users": <UsersList />, "admin-bookings": <AdminBookings />,
  "admin-availability": <AdminAvailability />, "admin-audits": <AdminAuditLogs />,
  "admin-hospitals-empty": <HospitalsManager />, "admin-consultants-empty": <ConsultantsManager />,
  "admin-users-empty": <UsersList />, "admin-bookings-empty": <AdminBookings />,
  "admin-availability-empty": <AdminAvailability />, "admin-audits-empty": <AdminAuditLogs />,
  "hospital-dashboard": <HospitalDashboard />, "hospital-profile": <HospitalProfile />, "hospital-services": <ServicesManager />,
  "hospital-bookings": <HospitalBookings />, "hospital-availability": <HospitalAvailability />, "hospital-password": <HospitalChangePasswordForm />,
  "hospital-services-empty": <ServicesManager />, "hospital-bookings-empty": <HospitalBookings />,
  "hospital-availability-empty": <HospitalAvailability />,
  "admin-login": <LoginForm role="admin" />, "hospital-login": <LoginForm role="hospital" />,
  "admin-forgot": <GuestOnly role="admin"><ForgotPasswordForm role="admin" /></GuestOnly>, "hospital-forgot": <GuestOnly role="hospital"><ForgotPasswordForm role="hospital" /></GuestOnly>,
  "consumer-bookings": <ConsumerBookings />,
  "consumer-bookings-empty": <ConsumerBookings />,
  "consumer-consultation-new": <ConsultationBookingForm serviceId="prenatal-doctor" />,
  "consumer-consultation-empty": <ConsultationBookingForm serviceId="prenatal-doctor" />,
  "consumer-consultation-refresh": <ConsultationBookingForm serviceId="prenatal-doctor" />,
  "consumer-consultations": <ConsultationBookings role="consumer" />,
  "consumer-consultations-empty": <ConsultationBookings role="consumer" />,
  "admin-consultations": <ConsultationBookings role="admin" />,
  "admin-consultations-email-failure": <ConsultationBookings role="admin" />,
  "admin-consultations-consultant-email-failure": <ConsultationBookings role="admin" />,
  "consumer-profile": <ConsumerProfile editing />,
  "consumer-support": <ConsumerSupport />,
  "consumer-completion": <ConsumerProfile />,
  "consumer-booking-detail": <ConsumerBookings bookingId="booking-1" />,
  "admin-booking-detail": <AdminBookings bookingId="booking-1" />,
  "hospital-booking-detail": <HospitalBookings bookingId="booking-1" />,
  "consumer-auto-confirmed": <ConsumerBookings bookingId="booking-0" />,
  "admin-auto-confirmed": <AdminBookings bookingId="booking-0" />,
  "hospital-auto-confirmed": <HospitalBookings bookingId="booking-0" />,
  "consumer-request": <BookingRequestForm hospitalId="centre" serviceId="package-14" searchContext={{ startDate: "", endDate: "", bystanders: 1 }} />,
  "consumer-request-prefilled": <BookingRequestForm hospitalId="centre" serviceId="package-14" searchContext={{ startDate: "2099-10-25", endDate: "2099-10-30", bystanders: 1 }} />,
};
window.mountPortalUi = (screen) => {
  portalUiState.screen = screen;
  if (screen === "consumer-consultation-refresh") portalUiState.publicConsultantReads = 0;
  const root = createRoot(document.getElementById("fixture-root")!);
  window.unmountPortalUi = () => root.unmount();
  root.render(<PortalEnvironment area={screen.startsWith("consumer") ? "consumer" : screen.startsWith("hospital") ? "hospital" : "admin"}>{screens[screen as keyof typeof screens]}<PortalToastViewport /></PortalEnvironment>);
};
Object.assign(window, { consumerBookingFixture: portalUiState });
