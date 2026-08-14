export const DURATION_UNITS = ["minutes", "hours", "days"] as const;
export type DurationUnit = typeof DURATION_UNITS[number];

const UNIT_MINUTES: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export function isDurationUnit(value: unknown): value is DurationUnit {
  return typeof value === "string" && DURATION_UNITS.includes(value as DurationUnit);
}

export function durationToMinutes(value: number, unit: DurationUnit) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid service duration.");
  const minutes = Math.round(value * UNIT_MINUTES[unit]);
  if (!Number.isSafeInteger(minutes) || minutes < 1) throw new Error("Enter a valid service duration.");
  return minutes;
}

export function durationValueFromMinutes(minutes: number, unit: DurationUnit) {
  return minutes / UNIT_MINUTES[unit];
}

export function inferDurationUnit(minutes: number): DurationUnit {
  if (minutes >= UNIT_MINUTES.days && minutes % UNIT_MINUTES.days === 0) return "days";
  if (minutes >= UNIT_MINUTES.hours && minutes % UNIT_MINUTES.hours === 0) return "hours";
  return "minutes";
}

export function formatServiceDuration(minutes: number | null, preferredUnit?: DurationUnit | null) {
  if (!minutes || minutes <= 0) return "Duration on request";
  const unit = preferredUnit ?? inferDurationUnit(minutes);
  const value = durationValueFromMinutes(minutes, unit);
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  const label = value === 1 ? unit.slice(0, -1) : unit;
  return `${formatted} ${label}`;
}
