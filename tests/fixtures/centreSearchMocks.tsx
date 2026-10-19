import type { AnchorHTMLAttributes } from "react";
export { searchPublicHospitals, listPublicHospitalServices } from "./comparisonMocks";
export class Timestamp { toDate() { return new Date(0); } }

export default function MockLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} />; }
const hospitals = [
  { id: "alpha", name: "Ayursarga Mother and Baby Ayurvedic Care and Wellness Centre", city: "Kozhikode", district: "Kozhikode", state: "Kerala", address: "Centre Road", description: "Personalised Ayurvedic care for mothers and families, with residential packages and professional guidance.", ayursargaRating: 4.5, ayursargaReviewNote: "A calm setting with clear care information for families.", imageUrls: Array.from({ length: 10 }, (_, i) => `https://images.test/centre-${i}.svg`) },
  { id: "beta", name: "Sanjeevani", city: "Palakkad", state: "Kerala", address: "Hospital Road", description: "Explore the centre's available care options.", imageUrls: [] },
];
export async function listPublicHospitals() { return { documents: hospitals, cursor: null, hasMore: false }; }
export const listPublicHospitalsByServiceName = listPublicHospitals;
