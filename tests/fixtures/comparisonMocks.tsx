import type { ReactNode } from "react";

const centers = ["Alpha", "Beta", "Gamma"].map((name) => ({ id: name.toLowerCase(), name, city: "Palakkad", state: "Kerala", imageUrls: ["https://images.test/center.webp"] }));
export const comparisonCalls: string[] = [];
declare global { interface Window { comparisonSearchDelay?: number; comparisonSearchFails?: boolean; } }
export default function MockLink({ href, children }: { href: string; children: ReactNode }) { return <a href={href}>{children}</a>; }
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
