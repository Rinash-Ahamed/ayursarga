import { isIsoDate } from "@/utils/date";

export type ConsultationCancellationPolicy = {
  version: string;
  refundWindowHours: number;
  cancellationCutoffHours: number;
  allowAfterCutoff: boolean;
  refundType: "percentage" | "fixed";
  /** Percentage, or INR for a fixed refund; always capped to verified payment. */
  refundValue: number;
  lateRefundValue: number;
  conditions: string;
};
export type ConsultationCancellationSnapshot = {
  policy: ConsultationCancellationPolicy;
  appointmentAt: string;
  cancellationCutoffAt: string;
  refundDeadlineAt: string;
  lastCancellationAt: string;
  timeZone: "Asia/Kolkata";
  reference: "window_start" | "exact_time";
};
export type ConsultationPaymentTotals = { paidPaise: number; refundedPaise: number };
export type ConsultationCancellationOutcome = {
  requestedAt: string; policyVersion: string | null; eligibleRefundPaise: number | null; remainingRefundPaise: number | null;
};

/** Published online consultation terms, not the example 24-hour policy. */
export const DEFAULT_CONSULTATION_CANCELLATION_POLICY: ConsultationCancellationPolicy = {
  version: "consultation-published-48h-v1", refundWindowHours: 48, cancellationCutoffHours: 48,
  allowAfterCutoff: true, refundType: "percentage", refundValue: 100, lateRefundValue: 0,
  conditions: "Exceptional circumstances require Ayursarga approval. Applicable legal rights remain unaffected. Eligible refunds use the original payment method.",
};

export function parseConsultationCancellationPolicy(value: unknown): ConsultationCancellationPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const amount = (n: unknown) => typeof n === "number" && Number.isSafeInteger(Math.round(n * 100)) && n >= 0 && n <= 10000000 && Math.abs(n * 100 - Math.round(n * 100)) < 0.000001;
  const hours = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 8760;
  if (typeof p.version !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(p.version)
    || !hours(p.refundWindowHours) || !hours(p.cancellationCutoffHours) || typeof p.allowAfterCutoff !== "boolean"
    || (p.refundType !== "percentage" && p.refundType !== "fixed") || !amount(p.refundValue) || !amount(p.lateRefundValue)
    || (p.refundType === "percentage" && (Number(p.refundValue) > 100 || Number(p.lateRefundValue) > 100))
    || typeof p.conditions !== "string" || p.conditions.length > 1000) return null;
  return { version: p.version, refundWindowHours: Number(p.refundWindowHours), cancellationCutoffHours: Number(p.cancellationCutoffHours),
    allowAfterCutoff: p.allowAfterCutoff, refundType: p.refundType as "percentage" | "fixed", refundValue: Number(p.refundValue),
    lateRefundValue: Number(p.lateRefundValue), conditions: p.conditions.trim() };
}

export function snapshotConsultationCancellation(policy: ConsultationCancellationPolicy, date: string, time: string, exact = false): ConsultationCancellationSnapshot {
  if (!parseConsultationCancellationPolicy(policy) || !isIsoDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid cancellation reference.");
  const start = Date.parse(`${date}T${time}:00+05:30`);
  return { policy: { ...policy }, appointmentAt: new Date(start).toISOString(), timeZone: "Asia/Kolkata", reference: exact ? "exact_time" : "window_start",
    cancellationCutoffAt: new Date(start - policy.cancellationCutoffHours * 3600000).toISOString(),
    refundDeadlineAt: new Date(start - policy.refundWindowHours * 3600000).toISOString(),
    lastCancellationAt: new Date(policy.allowAfterCutoff ? start : start - policy.cancellationCutoffHours * 3600000).toISOString() };
}

export function validCancellationSnapshot(value: unknown): value is ConsultationCancellationSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as ConsultationCancellationSnapshot;
  const p = parseConsultationCancellationPolicy(s.policy);
  if (!p || s.timeZone !== "Asia/Kolkata" || !["window_start", "exact_time"].includes(s.reference)) return false;
  const start = Date.parse(s.appointmentAt);
  return Number.isFinite(start) && Date.parse(s.refundDeadlineAt) === start - p.refundWindowHours * 3600000
    && Date.parse(s.cancellationCutoffAt) === start - p.cancellationCutoffHours * 3600000
    && Date.parse(s.lastCancellationAt) === (p.allowAfterCutoff ? start : start - p.cancellationCutoffHours * 3600000);
}

export function consultationCancellationEligibility(snapshot: ConsultationCancellationSnapshot, status: string, totals: ConsultationPaymentTotals | null, now: number) {
  if (!validCancellationSnapshot(snapshot) || !Number.isFinite(now)) return { allowed: false, refundValue: null, eligibleRefundPaise: null, remainingRefundPaise: null };
  const p = snapshot.policy;
  const allowed = ["confirmed", "requested"].includes(status) && now < Date.parse(snapshot.appointmentAt)
    && (p.allowAfterCutoff || now <= Date.parse(snapshot.cancellationCutoffAt));
  const refundValue = now <= Date.parse(snapshot.refundDeadlineAt) ? p.refundValue : p.lateRefundValue;
  const verified = totals && Number.isSafeInteger(totals.paidPaise) && Number.isSafeInteger(totals.refundedPaise)
    && totals.paidPaise >= 0 && totals.refundedPaise >= 0 && totals.refundedPaise <= totals.paidPaise;
  const eligibleRefundPaise = !verified ? null : Math.min(totals.paidPaise, p.refundType === "fixed" ? Math.round(refundValue * 100)
    : Number((BigInt(totals.paidPaise) * BigInt(Math.round(refundValue * 100)) + 5000n) / 10000n));
  return { allowed, refundValue, eligibleRefundPaise, remainingRefundPaise: eligibleRefundPaise === null || !totals ? null : Math.max(0, eligibleRefundPaise - totals.refundedPaise) };
}
