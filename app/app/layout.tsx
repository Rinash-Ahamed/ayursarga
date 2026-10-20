import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalProviders } from "@/components/auth/PortalProviders";
import "../portal.css";

export const metadata: Metadata = {
  title: "Ayursarga Consumer App",
  robots: { index: false, follow: false },
};

/** Protected consumer account and booking workflows; discovery stays public. */
export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return <PortalProviders area="consumer">{children}</PortalProviders>;
}
