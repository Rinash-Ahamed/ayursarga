import "server-only";

const PUBLIC_HOSPITAL_FIELDS = [
  "name", "description", "email", "phone", "hospitalPhone1", "hospitalPhone2",
  "address", "city", "district", "state", "imageUrl", "imageUrls",
  "ayursargaRating", "ayursargaReviewNote", "centreGuidelines", "additionalCentreRules",
  "facilities", "legalPolicies", "locationUrl", "additionalBystandersAllowed",
  "maxAdditionalBystanders", "additionalBystanderCharge", "status", "isPublic",
] as const;

const PUBLIC_HOSPITAL_LIST_FIELDS = [
  "name", "description", "address", "city", "district", "state",
  "imageUrl", "imageUrls", "ayursargaRating", "ayursargaReviewNote",
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

function projectedBlockedDateRanges(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((range: unknown) => {
      if (!range || typeof range !== "object") return [];
      const record = range as Record<string, unknown>;
      const startDate = timestampIso(record.startDate);
      const endDate = timestampIso(record.endDate);
      return startDate && endDate ? [{ startDate, endDate }] : [];
    })
    : [];
}

function projectFields(
  id: string,
  data: FirebaseFirestore.DocumentData,
  fields: readonly string[],
) {
  const projected: Record<string, unknown> = { id };
  fields.forEach((field) => {
    if (field in data) projected[field] = data[field];
  });
  return projected;
}

export function publicHospitalProjection(id: string, data: FirebaseFirestore.DocumentData) {
  const projected = projectFields(id, data, PUBLIC_HOSPITAL_FIELDS);
  projected.blockedDateRanges = projectedBlockedDateRanges(data.blockedDateRanges);
  return projected;
}

export function publicHospitalListProjection(id: string, data: FirebaseFirestore.DocumentData) {
  const projected = projectFields(id, data, PUBLIC_HOSPITAL_LIST_FIELDS);
  projected.blockedDateRanges = projectedBlockedDateRanges(data.blockedDateRanges);
  return projected;
}

export function publicServiceProjection(id: string, data: FirebaseFirestore.DocumentData) {
  return projectFields(id, data, PUBLIC_SERVICE_FIELDS);
}

export function publicPageSize(value: string | null, fallback = 12) {
  const requested = Number(value ?? fallback);
  return Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 24) : fallback;
}

export function validPublicDocumentId(value: string | null) {
  if (!value || value.length > 160 || value.includes("/")) return null;
  return value;
}
