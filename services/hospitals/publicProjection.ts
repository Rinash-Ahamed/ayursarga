import "server-only";

const PUBLIC_HOSPITAL_FIELDS = [
  "name", "description", "email", "phone", "hospitalPhone1", "hospitalPhone2",
  "address", "city", "district", "state", "imageUrl", "imageUrls",
  "ayursargaRating", "ayursargaReviewNote", "centreGuidelines", "additionalCentreRules",
  "facilities", "legalPolicies", "locationUrl", "additionalBystandersAllowed",
  "maxAdditionalBystanders", "additionalBystanderCharge", "status", "isPublic",
] as const;

const PUBLIC_SERVICE_FIELDS = [
  "hospitalId", "name", "description", "price", "durationMinutes", "durationUnit",
  "packageDurationDays", "procedures", "otherProcedures", "otherProcedureName",
  "otherProcedureDays", "status",
] as const;

function timestampIso(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) return null;
  const toDate = (value as { toDate?: unknown }).toDate;
  if (typeof toDate !== "function") return null;
  const date = toDate.call(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

export function publicHospitalProjection(id: string, data: FirebaseFirestore.DocumentData) {
  const projected: Record<string, unknown> = { id };
  PUBLIC_HOSPITAL_FIELDS.forEach((field) => {
    if (field in data) projected[field] = data[field];
  });
  projected.blockedDateRanges = Array.isArray(data.blockedDateRanges)
    ? data.blockedDateRanges.flatMap((range: unknown) => {
      if (!range || typeof range !== "object") return [];
      const value = range as Record<string, unknown>;
      const startDate = timestampIso(value.startDate);
      const endDate = timestampIso(value.endDate);
      return startDate && endDate ? [{ startDate, endDate }] : [];
    })
    : [];
  return projected;
}

export function publicServiceProjection(id: string, data: FirebaseFirestore.DocumentData) {
  const projected: Record<string, unknown> = { id };
  PUBLIC_SERVICE_FIELDS.forEach((field) => {
    if (field in data) projected[field] = data[field];
  });
  return projected;
}

export function publicPageSize(value: string | null, fallback = 12) {
  const requested = Number(value ?? fallback);
  return Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 24) : fallback;
}

export function validPublicDocumentId(value: string | null) {
  if (!value || value.length > 160 || value.includes("/")) return null;
  return value;
}
