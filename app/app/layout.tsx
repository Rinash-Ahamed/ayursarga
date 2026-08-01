import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalProviders } from "@/components/auth/PortalProviders";
import "../portal.css";

export const metadata: Metadata = {
  title: "Ayursarga Consumer App",
  robots: { index: false, follow: false },
};

/** Route boundary reserved for consumer discovery and booking features. */
export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return <PortalProviders area="consumer">{children}</PortalProviders>;
}
