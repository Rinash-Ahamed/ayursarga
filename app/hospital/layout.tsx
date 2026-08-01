import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalProviders } from "@/components/auth/PortalProviders";
import "../portal.css";

export const metadata: Metadata = {
  title: "Ayursarga Hospital Portal",
  robots: { index: false, follow: false },
};

/** Route boundary reserved for authenticated hospital operations. */
export default function HospitalLayout({ children }: { children: ReactNode }) {
  return <PortalProviders area="hospital">{children}</PortalProviders>;
}
