import { RequireRole } from "@/components/auth/RequireRole";
import { ConsumerSupport } from "@/components/consumer/ConsumerSupport";

export default function ConsumerSupportPage() {
  return <RequireRole role="consumer"><ConsumerSupport /></RequireRole>;
}
