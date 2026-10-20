import Link from "next/link";
import { ROUTES } from "@/config/routes";

export function ConsumerPortalFooter() {
  return <footer className="consumer-portal-footer">
    <nav aria-label="Consumer policies and support">
      <Link href={ROUTES.public.privacyPolicy}>Privacy policy</Link>
      <Link href={ROUTES.public.termsAndConditions}>Terms &amp; conditions</Link>
      <Link href={ROUTES.public.cancellationRefundPolicy}>Cancellation &amp; refund</Link>
      <Link href={ROUTES.public.patientServiceDisclaimer}>Service disclaimer &amp; consent</Link>
      <Link href={ROUTES.consumer.support}>Contact us</Link>
    </nav>
    <small>© Ayursarga. All rights reserved.</small>
  </footer>;
}
