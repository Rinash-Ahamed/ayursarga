import type { AnchorHTMLAttributes } from "react";

const centers = ["Alpha", "Beta", "Gamma"].map((name) => ({ id: name.toLowerCase(), name, city: "Palakkad", state: "Kerala", imageUrls: ["https://images.test/center.webp"] }));
export const comparisonCalls: string[] = [];
export const comparisonDetailCalls: string[] = [];
declare global { interface Window { comparisonSearchDelay?: number; comparisonSearchFails?: boolean; } }
export default function MockLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} />; }
export async function getPublicHospital(id: string) {
  comparisonDetailCalls.push(id);
  const center = centers.find((item) => item.id === id);
  return center ? { ...center, facilities: id === "alpha" ? "Free Wi-Fi\nFree parking\nDoctor on call\nGarden\nLift\nTV\nFamily rooms" : id === "beta" ? "Baby cradle\nPower backup" : "" } : null;
}
export async function searchPublicHospitals(term: string) {
  if (window.comparisonSearchDelay) await new Promise((resolve) => setTimeout(resolve, window.comparisonSearchDelay));
  if (window.comparisonSearchFails) throw new Error("Test search failed");
  return { documents: centers.filter((center) => center.name.toLowerCase().includes(term.toLowerCase())) };
}
export async function listPublicHospitalServices(id: string, options: { signal?: AbortSignal }) {
  comparisonCalls.push(id);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, id === "alpha" ? 350 : 10);
    options.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
  return { documents: (id === "gamma" ? [21] : [7, 14]).map((days) => ({ id: `${id}-${days}`, status: "active", packageDurationDays: days, name: `${days}-day package`, price: days * 1000, procedures: { headMassage: 2 } })) };
}
