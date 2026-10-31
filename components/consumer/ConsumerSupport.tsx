import Link from "next/link";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/config/routes";
import { AYURSARGA_PHONE } from "@/config/contact";

export function ConsumerSupport() {
  return <PortalShell role="consumer" title="Help & support">
    <div className="consumer-support-grid">
      <section className="portal-card consumer-support-card">
        <h2>How can we help?</h2>
        <p>Contact Ayursarga for help with your booking or using your account. Include your booking ID so our team can identify the right booking.</p>
        <a className="consumer-support-contact" href="mailto:info@ayursarga.com"><span>Email us</span><strong>info@ayursarga.com</strong></a>
        <a className="consumer-support-contact" href={AYURSARGA_PHONE.href}><span>Call us</span><strong>{AYURSARGA_PHONE.display}</strong></a>
        <Link className="portal-button" href={ROUTES.public.contact}>Contact Ayursarga</Link>
      </section>
      <section className="portal-card consumer-support-card">
        <h2>Your booking, at a glance</h2>
        <p>My bookings shows your hospital, package, booking ID, care dates and the centre&apos;s latest response.</p>
        <p>Your hospital booking is confirmed after you book an available care date. “Booked on” shows when you made the booking; your care date shows when your stay begins. If a request is awaiting confirmation, contact us with your booking ID.</p>
        <div className="portal-actions"><Link className="portal-button secondary" href={ROUTES.consumer.bookings}>View my bookings</Link></div>
        <Link className="consumer-support-policy" href={ROUTES.public.cancellationRefundPolicy}>Read the cancellation &amp; refund policy</Link>
      </section>
    </div>
  </PortalShell>;
}
