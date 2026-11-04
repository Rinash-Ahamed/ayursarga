import { MAX_BOOKING_CHANGE_REASON } from "@/features/bookings/changeReason";

export function BookingChangeReasonField({ value, onChange, disabled, action }: { value: string; onChange: (value: string) => void; disabled?: boolean; action: "cancellation" | "reschedule" }) {
  return <label className="full">{action === "reschedule" ? "Rescheduling reason" : "Cancellation reason"} *
    <textarea value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required
      minLength={3} maxLength={MAX_BOOKING_CHANGE_REASON} rows={3} />
    <small>This reason will be shared in the {action === "reschedule" ? "rescheduling" : "cancellation"} email and booking details. Do not include sensitive medical information.</small>
  </label>;
}
