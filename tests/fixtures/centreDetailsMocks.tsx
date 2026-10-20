import type { AnchorHTMLAttributes } from "react";
export default function MockLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} />; }
export class Timestamp { constructor(private date: Date) {} toDate() { return this.date; } }
declare global { interface Window { centreDetailsBlocked?: boolean; } }
export async function getPublicHospital() {
  return { id: "alpha", name: "Ayursarga Mother and Baby Wellness Centre", status: "active", isPublic: true, city: "Palakkad", state: "Kerala", address: "Centre Road", imageUrls: [], blockedDateRanges: window.centreDetailsBlocked ? [{ startDate: new Timestamp(new Date("2099-10-25T00:00:00+05:30")), endDate: new Timestamp(new Date("2099-10-25T00:00:00+05:30")) }] : [] };
}
export async function listPublicHospitalServices() {
  return { documents: [21, 7, 14, 28].map((days) => ({ id: `package-${days}`, hospitalId: "alpha", name: `${days}-day package`, packageDurationDays: days, status: "active", price: days * 2000, description: days === 7 ? "Personalised mother and baby care, with individual wellness support and professional guidance throughout your stay." : "Care and wellbeing support.", procedures: { headMassage: 2, hairPack: 3, fullBodyMassage: 4 }, otherProcedures: [{ name: "Personalised specialist-supervised restorative wellness procedure", days: 2 }] })), cursor: null, hasMore: false };
}
