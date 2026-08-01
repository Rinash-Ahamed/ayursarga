import { GuestOnly } from "@/components/auth/RequireRole";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function AdminForgotPasswordPage() {
  return <GuestOnly><ForgotPasswordForm role="admin" /></GuestOnly>;
}
