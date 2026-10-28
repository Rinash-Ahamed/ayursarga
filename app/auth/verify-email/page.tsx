import type { Metadata } from "next";
import { EmailVerificationForm } from "@/components/auth/EmailVerificationForm";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import "../../portal.css";

export const metadata: Metadata = { title: "Verify Email | Ayursarga", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function EmailVerificationPage() {
  return <PortalEnvironment area="admin"><EmailVerificationForm /></PortalEnvironment>;
}
