import { GuestOnly } from "@/components/auth/RequireRole";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function HospitalForgotPasswordPage() {
  return <GuestOnly role="hospital"><ForgotPasswordForm role="hospital" /></GuestOnly>;
}
