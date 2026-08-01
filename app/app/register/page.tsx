import { GuestOnly } from "@/components/auth/RequireRole";
import { RegisterConsumerForm } from "@/components/auth/RegisterConsumerForm";

export default function ConsumerRegistrationPage() {
  return <GuestOnly><RegisterConsumerForm /></GuestOnly>;
}
