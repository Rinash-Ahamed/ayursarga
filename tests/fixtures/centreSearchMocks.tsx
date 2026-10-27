import type { AnchorHTMLAttributes } from "react";
export { searchPublicHospitals, listPublicHospitalServices, getPublicHospital } from "./comparisonMocks";
export class Timestamp { constructor(private date = new Date(0)) {} toDate() { return this.date; } }

export default function MockLink({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  // Preserve Next's prefetch option for assertions without forwarding it as an HTML attribute.
  return <a {...props} data-prefetch={prefetch === false ? "disabled" : "auto"} />;
}
const hospitals = [
  { id: "alpha", name: "Ayursarga Mother and Baby Ayurvedic Care and Wellness Centre", city: "Kozhikode", district: "Kozhikode", state: "Kerala", address: "Centre Road", description: "Personalised Ayurvedic care for mothers and families, with residential packages and professional guidance.", ayursargaRating: 4.5, ayursargaReviewNote: "A calm setting with clear care information for families.", imageUrls: Array.from({ length: 10 }, (_, i) => `https://images.test/centre-${i}.svg`) },
  { id: "beta", name: "Sanjeevani", city: "Palakkad", state: "Kerala", address: "Hospital Road", description: "Explore the centre's available care options.", imageUrls: [] },
];
declare global { interface Window { centreSearchDelay?: number; centreSearchHasMore?: boolean; centreSearchCalls?: Array<string | null>; centreSearchBlocked?: boolean; centreSearchImageUrls?: string[]; } }
export async function listPublicHospitals(options?: { cursor?: string | null }) {
  window.centreSearchCalls ??= [];
  window.centreSearchCalls.push(options?.cursor ?? null);
  if (window.centreSearchDelay) await new Promise((resolve) => setTimeout(resolve, window.centreSearchDelay));
  if (options?.cursor) return { documents: [{ ...hospitals[1], id: "further", name: "Further Centre" }], cursor: null, hasMore: false };
  return { documents: hospitals.map((hospital, index) => ({ ...hospital, imageUrls: index === 0 && window.centreSearchImageUrls ? window.centreSearchImageUrls : hospital.imageUrls, blockedDateRanges: window.centreSearchBlocked && index === 0 ? [{ startDate: new Timestamp(new Date("2099-10-25T00:00:00+05:30")), endDate: new Timestamp(new Date("2099-10-25T00:00:00+05:30")) }] : [] })), cursor: window.centreSearchHasMore ? "next" : null, hasMore: Boolean(window.centreSearchHasMore) };
}
export const listPublicHospitalsByServiceName = listPublicHospitals;
