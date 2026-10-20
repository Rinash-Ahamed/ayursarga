import type { AnchorHTMLAttributes } from "react";
export { searchPublicHospitals, listPublicHospitalServices } from "./comparisonMocks";
export class Timestamp { toDate() { return new Date(0); } }

export default function MockLink({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  // Preserve Next's prefetch option for assertions without forwarding it as an HTML attribute.
  return <a {...props} data-prefetch={prefetch === false ? "disabled" : "auto"} />;
}
const hospitals = [
  { id: "alpha", name: "Ayursarga Mother and Baby Ayurvedic Care and Wellness Centre", city: "Kozhikode", district: "Kozhikode", state: "Kerala", address: "Centre Road", description: "Personalised Ayurvedic care for mothers and families, with residential packages and professional guidance.", ayursargaRating: 4.5, ayursargaReviewNote: "A calm setting with clear care information for families.", imageUrls: Array.from({ length: 10 }, (_, i) => `https://images.test/centre-${i}.svg`) },
  { id: "beta", name: "Sanjeevani", city: "Palakkad", state: "Kerala", address: "Hospital Road", description: "Explore the centre's available care options.", imageUrls: [] },
];
declare global { interface Window { centreSearchDelay?: number; } }
export async function listPublicHospitals() {
  if (window.centreSearchDelay) await new Promise((resolve) => setTimeout(resolve, window.centreSearchDelay));
  return { documents: hospitals, cursor: null, hasMore: false };
}
export const listPublicHospitalsByServiceName = listPublicHospitals;
