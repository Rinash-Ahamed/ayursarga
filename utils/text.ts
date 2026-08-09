export function toTrimmedString(value: unknown, maxLength = Number.POSITIVE_INFINITY) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}
