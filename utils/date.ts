export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const candidate = (value as { toDate?: unknown }).toDate;
    if (typeof candidate === "function") {
      const parsed = candidate.call(value);
      return parsed instanceof Date ? parsed : null;
    }
  }
  return null;
}

export function getCalendarMonthRange(value = new Date()) {
  return {
    start: new Date(value.getFullYear(), value.getMonth(), 1),
    end: new Date(value.getFullYear(), value.getMonth() + 1, 1),
  };
}

export function formatMonthYear(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(value);
}
