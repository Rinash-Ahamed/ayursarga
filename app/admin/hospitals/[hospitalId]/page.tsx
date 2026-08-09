import { RequireRole } from "@/components/auth/RequireRole";
import { AdminHospitalDetails } from "@/components/admin/HospitalDetails";

export default async function AdminHospitalDetailsPage({ params }: { params: Promise<{ hospitalId: string }> }) {
  const { hospitalId } = await params;
  return <RequireRole role="admin"><AdminHospitalDetails hospitalId={hospitalId} /></RequireRole>;
}
