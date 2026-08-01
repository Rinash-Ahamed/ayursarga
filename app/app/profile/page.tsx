import { RequireRole } from "@/components/auth/RequireRole";
import { ConsumerProfile } from "@/components/consumer/ConsumerProfile";
export default function ConsumerProfilePage() { return <RequireRole role="consumer"><ConsumerProfile /></RequireRole>; }
