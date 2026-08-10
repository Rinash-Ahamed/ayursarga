import { RequireRole } from "@/components/auth/RequireRole";
import { HospitalChangePasswordForm } from "@/components/hospital/ChangePasswordForm";

export default function HospitalChangePasswordPage() {
  return <RequireRole role="hospital"><HospitalChangePasswordForm /></RequireRole>;
}
