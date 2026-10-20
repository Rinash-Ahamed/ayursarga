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

/** Date-only values are calendar dates, never UTC instants. */
export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00Z`);
  return year > 0 && !Number.isNaN(date.getTime()) && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isIsoDate(iso) ? iso : null;
}

export function toDateInputValue(value: unknown = new Date()): string {
  if (typeof value === "string" && isIsoDate(value)) return value;
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatDisplayDate(value: unknown, fallback = ""): string {
  if (value == null || value === "") return fallback;
  // Reject ambiguous numeric strings instead of letting Date guess month/day.
  if (typeof value === "string" && /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(value)) {
    const parsed = parseDisplayDate(value);
    return parsed ? formatDisplayDate(parsed, fallback) : fallback;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isIsoDate(value)) return fallback;
  const iso = toDateInputValue(value);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : fallback;
}

export function parseDateInputValue(value: string): Date | null {
  return isIsoDate(value) ? new Date(`${value}T00:00:00+05:30`) : null;
}

export function formatDisplayDateTime(value: unknown, fallback = "") {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
  return `${formatDisplayDate(date)}, ${time}`;
}

/** Display legacy generated notification dates without rewriting saved records. */
export function formatDateMentions(text: string) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) => formatDisplayDate(date, date))
    .replace(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi,
      (original, day: string, month: string, year: string) => formatDisplayDate(`${year}-${String(months.indexOf(month.slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`, original))
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (original, day: string, month: string, year: string) => formatDisplayDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, original));
}

export function getCalendarMonthRange(value = new Date()) {
  const [year, month] = toDateInputValue(value).split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    start: parseDateInputValue(`${year}-${String(month).padStart(2, "0")}-01`)!,
    end: parseDateInputValue(nextMonth)!,
  };
}

export function formatMonthYear(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(value);
}
