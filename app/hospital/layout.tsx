import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ayursarga Hospital Portal",
  robots: { index: false, follow: false },
};

/** Route boundary reserved for authenticated hospital operations. */
export default function HospitalLayout({ children }: { children: ReactNode }) {
  return children;
}
