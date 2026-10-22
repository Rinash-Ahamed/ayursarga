import type { Metadata } from "next";
import { PasswordActionForm } from "@/components/auth/PasswordActionForm";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import "../../portal.css";

export const metadata: Metadata = {
  title: "Set Your Password | Ayursarga",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PasswordActionPage() {
  return <PortalEnvironment area="hospital"><PasswordActionForm /></PortalEnvironment>;
}
