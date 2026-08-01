import { GuestOnly } from "@/components/auth/RequireRole";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ConsumerForgotPasswordPage() {
  return <GuestOnly><ForgotPasswordForm role="consumer" /></GuestOnly>;
}
