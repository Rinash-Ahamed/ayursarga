import { RequireRole } from "@/components/auth/RequireRole";
import { ConsumerProfile } from "@/components/consumer/ConsumerProfile";

export default function ConsumerProfileCompletionPage() {
  return <RequireRole role="consumer"><ConsumerProfile completion /></RequireRole>;
}
