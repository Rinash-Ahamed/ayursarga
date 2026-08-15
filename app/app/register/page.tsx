import { GuestOnly } from "@/components/auth/RequireRole";
import { ConsumerGoogleAuthForm } from "@/components/auth/ConsumerGoogleAuthForm";

export default function ConsumerRegistrationPage() {
  return <GuestOnly role="consumer"><ConsumerGoogleAuthForm mode="register" /></GuestOnly>;
}
