import { HospitalDetails } from "@/components/consumer/HospitalDetails";
export default async function HospitalDetailsPage({ params }: { params: Promise<{ hospitalId: string }> }) {
  return <HospitalDetails hospitalId={(await params).hospitalId} />;
}
