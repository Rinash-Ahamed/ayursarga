import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { BOOKING_TERMS_VERSION, CONSUMER_PRIVACY_NOTICE_VERSION, CUSTOMER_TERMS_VERSION } from "@/features/consumers/privacyConsent";
import { INCLUDED_BYSTANDERS, resolveHospitalBystanderPolicy } from "@/features/hospitals/bystanders";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

function validId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && !value.includes("/") ? value : null;
}

function parseCareDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateBlocked(hospital: FirebaseFirestore.DocumentData, start: Date, end: Date) {
  return Array.isArray(hospital.blockedDateRanges) && hospital.blockedDateRanges.some((range: unknown) => {
    if (!range || typeof range !== "object") return false;
    const value = range as { startDate?: { toDate?: () => Date }; endDate?: { toDate?: () => Date } };
    const blockedStart = value.startDate?.toDate?.();
    const blockedEnd = value.endDate?.toDate?.();
    return Boolean(blockedStart && blockedEnd && start <= blockedEnd && end >= blockedStart);
  });
}

export async function POST(request: Request) {
  try {
    const { uid, profile, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(requestFingerprint(request, `consumer-booking:${uid}`), 20, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many appointment requests were sent. Please wait a few minutes and try again." }, 429);
    }
    const body = await readJsonBody(request, 8_000) as Record<string, unknown> | null;
    if (!body) return apiJson({ error: "Booking details are required." }, 400);
    if (profile.privacyConsentVersion !== CONSUMER_PRIVACY_NOTICE_VERSION
      || profile.customerTermsVersion !== CUSTOMER_TERMS_VERSION
      || !profile.privacyConsentAt || !profile.customerTermsAcceptedAt
      || typeof profile.phone !== "string" || profile.phone.trim().length < 7) {
      return apiJson({ error: "Complete your contact details and consent before requesting an appointment." }, 409);
    }
    if (body.bookingTermsAccepted !== true) return apiJson({ error: "Read and accept the applicable terms and policies before sending your request." }, 400);

    const hospitalId = validId(body.hospitalId);
    const serviceId = validId(body.serviceId);
    const requestId = typeof body.requestId === "string" && /^[a-zA-Z0-9-]{16,100}$/.test(body.requestId) ? body.requestId : null;
    const preferredDateText = typeof body.preferredDate === "string" ? body.preferredDate : "";
    const preferredEndDateText = typeof body.preferredEndDate === "string" ? body.preferredEndDate : "";
    const preferredDate = parseCareDate(preferredDateText);
    const preferredEndDate = preferredEndDateText ? parseCareDate(preferredEndDateText) : preferredDate;
    const bystanderCount = Number(body.bystanderCount);
    const consumerNotes = typeof body.consumerNotes === "string" ? body.consumerNotes.trim().slice(0, 500) : "";
    if (!hospitalId || !serviceId || !requestId || !preferredDate || !preferredEndDate
      || preferredDateText < todayInIndia() || preferredEndDate < preferredDate) {
      return apiJson({ error: "Choose a valid hospital, package, and preferred care date." }, 400);
    }

    const [hospitalSnapshot, serviceSnapshot] = await Promise.all([
      firestore.collection("hospitals").doc(hospitalId).get(),
      firestore.collection("services").doc(serviceId).get(),
    ]);
    const hospital = hospitalSnapshot.data();
    const service = serviceSnapshot.data();
    if (!hospitalSnapshot.exists || hospital?.status !== "active" || hospital.isPublic !== true) {
      return apiJson({ error: "This hospital is not accepting appointment requests right now." }, 409);
    }
    if (!serviceSnapshot.exists || service?.status !== "active" || service.hospitalId !== hospitalId) {
      return apiJson({ error: "This package is not accepting appointment requests right now." }, 409);
    }
    if (dateBlocked(hospital, preferredDate, preferredEndDate)) {
      return apiJson({ error: "This hospital is unavailable for the selected dates. Choose another date and try again." }, 409);
    }

    const bystanderPolicy = resolveHospitalBystanderPolicy(hospital);
    const maximumBystanders = INCLUDED_BYSTANDERS + bystanderPolicy.maxAdditionalBystanders;
    if (!Number.isInteger(bystanderCount) || bystanderCount < INCLUDED_BYSTANDERS || bystanderCount > maximumBystanders) {
      return apiJson({ error: "Choose a valid number of accompanying bystanders." }, 400);
    }
    const servicePrice = Number(service.price ?? 0);
    const commissionPercentage = Number(hospital.commissionPercentage);
    if (!Number.isFinite(servicePrice) || servicePrice < 0 || !Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      return apiJson({ error: "This package cannot be booked until its pricing is reviewed." }, 409);
    }

    const bookingId = createHash("sha256").update(`${uid}:${requestId}`).digest("hex");
    const bookingReference = firestore.collection("bookings").doc(bookingId);
    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const additionalBystanderTotal = (bystanderCount - INCLUDED_BYSTANDERS) * bystanderPolicy.additionalBystanderCharge;
    const bookingData = {
      consumerId: uid,
      consumerName: String(profile.name ?? "").trim(),
      consumerEmail: String(profile.email ?? "").trim().toLowerCase(),
      consumerPhone: profile.phone.trim(),
      consumerAddress: typeof profile.address === "string" ? profile.address.trim() || null : null,
      hospitalId,
      serviceId,
      preferredDate: Timestamp.fromDate(preferredDate),
      preferredEndDate: preferredEndDateText ? Timestamp.fromDate(preferredEndDate) : null,
      preferredTime: "Flexible",
      bystanderCount,
      additionalBystanderCharge: bystanderPolicy.additionalBystanderCharge,
      additionalBystanderTotal,
      confirmedDate: null,
      confirmedTime: null,
      status: "requested",
      treatmentStatus: "not_started",
      servicePrice,
      commissionPercentage,
      estimatedCommission: servicePrice * commissionPercentage / 100,
      consumerNotes: consumerNotes || null,
      hospitalNotes: null,
      createdAt: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid,
      archivedAt: null,
      archivedBy: null,
      confirmedAt: null,
      completedAt: null,
      treatmentStartedAt: null,
      treatmentCompletedAt: null,
      bookingTermsAcceptedAt: now,
      bookingTermsVersion: BOOKING_TERMS_VERSION,
      lastAuditId: auditReference.id,
    };
    const batch = firestore.batch();
    batch.create(bookingReference, bookingData);
    batch.set(auditReference, {
      action: "create", module: "bookings", recordId: bookingId,
      actorId: uid, actorRole: "consumer", previousValues: null, updatedValues: bookingData,
      timestamp: now, source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    try {
      await batch.commit();
      return apiJson({ ok: true, bookingId }, 201);
    } catch (error) {
      if ((error as { code?: number | string }).code === 6 || (error as { code?: number | string }).code === "already-exists") {
        const existing = await bookingReference.get();
        if (existing.exists && existing.data()?.consumerId === uid) return apiJson({ ok: true, bookingId, duplicate: true });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/consumer/bookings", error);
    return apiJson({ error: "We could not send your appointment request. Please try again." }, 503);
  }
}
