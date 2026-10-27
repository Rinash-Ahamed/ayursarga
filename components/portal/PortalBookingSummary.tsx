import type { ReactNode } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import { bookingDateFacts, bookingReferenceLabel, bookingStatusLabel } from "@/features/bookings/display";
import { getTreatmentProgress, getTreatmentStatus, treatmentStatusLabel } from "@/features/bookings/treatmentStatus";
import { formatBystanders } from "@/features/hospitals/searchContext";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";

export function PortalBookingSummary({ booking, showCommission = false, showTreatmentBadge = false, children }: {
  booking: BookingDocument; showCommission?: boolean; showTreatmentBadge?: boolean; children?: ReactNode;
}) {
  const startDate = formatDisplayDate(booking.preferredDate);
  const endDate = formatDisplayDate(booking.preferredEndDate);
  const treatment = getTreatmentStatus(booking);
  const treatmentBadge = showTreatmentBadge && ["confirmed", "completed"].includes(booking.status) && treatment !== "not_started";
  return <article className="portal-row consumer-booking-row operational-booking-card" data-accent={booking.status}>
    <div className="consumer-booking-copy">
      <span className="consumer-booking-reference">Booking ID: {bookingReferenceLabel(booking)}</span>
      <h3>{booking.hospitalName || "Centre details unavailable"}</h3>
      {booking.hospitalLocation && <p className="consumer-booking-location">{booking.hospitalLocation}</p>}
      <p className="consumer-booking-package">{booking.serviceName || "Package details unavailable"}</p>
      <dl className="consumer-booking-facts">
        <div><dt>Customer</dt><dd>{booking.consumerName || "Name not recorded"}</dd></div>
        <div><dt>Phone</dt><dd>{booking.consumerPhone || "Not recorded"}</dd></div>
        <div><dt>Email</dt><dd>{booking.consumerEmail || "Not recorded"}</dd></div>
        <div><dt>Requested care dates</dt><dd>{startDate}{endDate && endDate !== startDate ? ` to ${endDate}` : ""}{booking.preferredTime && booking.preferredTime !== "Flexible" ? ` · ${booking.preferredTime}` : ""}</dd></div>
        <div><dt>Accompanying</dt><dd>{formatBystanders(booking.bystanderCount ?? 1)}{(booking.additionalBystanderTotal ?? 0) > 0 && <small>{formatCurrency(booking.additionalBystanderTotal!)} additional</small>}</dd></div>
        <div><dt>Customer address</dt><dd>{booking.consumerAddress || "Not provided"}</dd></div>
        {bookingDateFacts(booking).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        {(booking.status === "confirmed" || booking.status === "completed") && <div><dt>Treatment</dt><dd>{getTreatmentProgress(treatment).label}</dd></div>}
      </dl>
      {booking.consumerNotes && <div className="consumer-booking-note"><strong>Customer note</strong><p>{booking.consumerNotes}</p></div>}
      {booking.hospitalNotes && <div className="consumer-booking-note"><strong>Centre response</strong><p>{booking.hospitalNotes}</p></div>}
    </div>
    <div className="consumer-booking-meta">
      <span className="portal-status" data-status={booking.status}>{treatmentBadge ? treatmentStatusLabel(treatment) : bookingStatusLabel(booking.status)}</span>
      <div className="consumer-booking-cost"><span>Package amount</span><strong>{formatCurrency(booking.servicePrice)}</strong><small>At time of request</small></div>
      {showCommission && <div className="consumer-booking-cost operational-booking-commission"><span>Estimated commission</span><strong>{formatCurrency(booking.estimatedCommission ?? 0)}</strong></div>}
    </div>
    {children && <div className="operational-booking-actions">{children}</div>}
  </article>;
}
