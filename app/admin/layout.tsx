import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalProviders } from "@/components/auth/PortalProviders";
import "../portal.css";

export const metadata: Metadata = {
  title: "Ayursarga Admin Portal",
  robots: { index: false, follow: false },
};

/** Route boundary reserved for authenticated administrative operations. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalProviders area="admin">{children}</PortalProviders>;
}
