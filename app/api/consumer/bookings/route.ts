import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { BOOKING_TERMS_VERSION, CONSUMER_PRIVACY_NOTICE_VERSION, CUSTOMER_TERMS_VERSION } from "@/features/consumers/privacyConsent";
import { INCLUDED_BYSTANDERS, resolveHospitalBystanderPolicy } from "@/features/hospitals/bystanders";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { isValidPhoneNumber } from "@/utils/phone";
import { packageTitle } from "@/features/hospitals/packages";
import { hasPublishedPackage } from "@/features/hospitals/packageReview";
import { publicPackageVersion } from "@/services/hospitals/publicProjection";
import { ensureBookingReference, reserveBookingReference } from "@/services/bookings/bookingReferenceAdmin";
import { addBookingNotifications, bookingNotificationRecipients } from "@/services/notifications/bookingNotificationsAdmin";
import { requestAuditDevice } from "@/services/api/audit";
import { parseDateInputValue } from "@/utils/date";
import { scheduleBookingConfirmation } from "@/services/email/bookingEmailService";

export const runtime = "nodejs";
export const maxDuration = 60;

class BookingFlowError extends Error {
  constructor(message: string, public readonly status: 400 | 409) { super(message); }
}

function validId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && !value.includes("/") ? value : null;
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

// Only resolve labels for bookings owned by this Consumer. Historical centres
// may no longer be public; never expose their full management documents.
export async function GET(request: Request) {
  try {
    const { uid, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(requestFingerprint(request, `consumer-booking-details:${uid}`), 120, 10 * 60 * 1000)) {
      return apiJson({ error: "Please wait a moment before loading more booking details." }, 429);
    }
    const ids = [...new Set(new URL(request.url).searchParams.getAll("id"))];
    if (!ids.length || ids.length > 20 || ids.some((id) => !validId(id))) {
      return apiJson({ error: "Choose up to 20 valid bookings." }, 400);
    }
    const bookings = await firestore.getAll(...ids.map((id) => firestore.collection("bookings").doc(id)), {
      fieldMask: ["consumerId", "hospitalId", "serviceId", "hospitalName", "hospitalLocation", "serviceName"],
    });
    if (bookings.some((booking) => !booking.exists || booking.data()?.consumerId !== uid)) {
      return apiJson({ error: "These booking details are not available." }, 403);
    }
    const hospitalIds = [...new Set(bookings.map((booking) => validId(booking.data()?.hospitalId)).filter((id) => id !== null))];
    const serviceIds = [...new Set(bookings.map((booking) => validId(booking.data()?.serviceId)).filter((id) => id !== null))];
    const [hospitals, services] = await Promise.all([
      hospitalIds.length ? firestore.getAll(...hospitalIds.map((id) => firestore.collection("hospitals").doc(id)), { fieldMask: ["name", "city", "district", "state"] }) : [],
      serviceIds.length ? firestore.getAll(...serviceIds.map((id) => firestore.collection("services").doc(id)), { fieldMask: ["name", "packageDurationDays", "hospitalId"] }) : [],
    ]);
    const hospitalMap = new Map(hospitals.map((hospital) => [hospital.id, hospital.data()]));
    const serviceMap = new Map(services.map((service) => [service.id, service.data()]));
    return apiJson({ details: Object.fromEntries(bookings.map((booking) => {
      const data = booking.data()!;
      const hospital = hospitalMap.get(data.hospitalId);
      const service = serviceMap.get(data.serviceId);
      return [booking.id, {
        hospitalName: data.hospitalName || hospital?.name || "",
        hospitalLocation: data.hospitalLocation || [hospital?.city, hospital?.district, hospital?.state].filter(Boolean).join(", "),
        serviceName: data.serviceName || (service && service.hospitalId === data.hospitalId ? packageTitle(service) : ""),
      }];
    })) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("GET /api/consumer/bookings", error);
    return apiJson({ error: "Booking details are temporarily unavailable." }, 503);
  }
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
      || typeof profile.phone !== "string" || !isValidPhoneNumber(profile.phone.trim())) {
      return apiJson({ error: "Complete your contact details and consent before requesting an appointment." }, 409);
    }
    if (body.bookingTermsAccepted !== true) return apiJson({ error: "Read and accept the applicable terms and policies before sending your request." }, 400);
    if (body.expectedPackageVersion !== undefined && (typeof body.expectedPackageVersion !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedPackageVersion))) return apiJson({ error: "Reload and review the selected package before booking." }, 400);

    const hospitalId = validId(body.hospitalId);
    const serviceId = validId(body.serviceId);
    const requestId = typeof body.requestId === "string" && /^[a-zA-Z0-9-]{16,100}$/.test(body.requestId) ? body.requestId : null;
    const preferredDateText = typeof body.preferredDate === "string" ? body.preferredDate : "";
    const preferredEndDateText = typeof body.preferredEndDate === "string" ? body.preferredEndDate : "";
    const preferredDate = parseDateInputValue(preferredDateText);
    const preferredEndDate = preferredEndDateText ? parseDateInputValue(preferredEndDateText) : preferredDate;
    const bystanderCount = Number(body.bystanderCount);
    const consumerNotes = typeof body.consumerNotes === "string" ? body.consumerNotes.trim().slice(0, 500) : "";
    if (!hospitalId || !serviceId || !requestId || !preferredDate || !preferredEndDate
      || preferredDateText < todayInIndia() || preferredEndDate < preferredDate) {
      return apiJson({ error: "Choose a valid hospital, package, and preferred care date." }, 400);
    }

    const bookingId = createHash("sha256").update(`${uid}:${requestId}`).digest("hex");
    const bookingDocument = firestore.collection("bookings").doc(bookingId);
    const existing = await bookingDocument.get();
    if (existing.exists) {
      if (existing.data()?.consumerId !== uid || existing.data()?.hospitalId !== hospitalId || existing.data()?.serviceId !== serviceId) {
        return apiJson({ error: "This booking attempt is already associated with different care details." }, 409);
      }
      const bookingReference = await ensureBookingReference(firestore, bookingId, { uid, role: "consumer" }, request);
      return apiJson({ ok: true, bookingId, bookingReference, duplicate: true });
    }
    const result = await firestore.runTransaction(async (transaction) => {
      const [current, hospitalSnapshot, serviceSnapshot] = await transaction.getAll(
        bookingDocument, firestore.collection("hospitals").doc(hospitalId), firestore.collection("services").doc(serviceId),
      );
      if (current.exists) {
        const data = current.data()!;
        if (data.consumerId !== uid || data.hospitalId !== hospitalId || data.serviceId !== serviceId) throw new BookingFlowError("This booking attempt is already associated with different care details.", 409);
        return { duplicate: true, bookingReference: String(data.bookingReference ?? "") };
      }
      const hospital = hospitalSnapshot.data();
      const service = serviceSnapshot.data();
      if (!hospitalSnapshot.exists || hospital?.status !== "active" || hospital.isPublic !== true) {
        throw new BookingFlowError("This hospital is not accepting bookings right now.", 409);
      }
      if (!serviceSnapshot.exists || service?.status !== "active" || service.hospitalId !== hospitalId || !hasPublishedPackage(service)) {
        throw new BookingFlowError("This package is not accepting bookings right now.", 409);
      }
      if (body.expectedPackageVersion !== undefined && body.expectedPackageVersion !== publicPackageVersion(serviceId, service)) throw new BookingFlowError("This package has changed. Return to the centre page and review the latest price and details before booking.", 409);
      if (dateBlocked(hospital, preferredDate, preferredEndDate)) {
        throw new BookingFlowError("This hospital is unavailable for the selected dates. Choose another date and try again.", 409);
      }

      const bystanderPolicy = resolveHospitalBystanderPolicy(hospital);
      const maximumBystanders = INCLUDED_BYSTANDERS + bystanderPolicy.maxAdditionalBystanders;
      if (!Number.isInteger(bystanderCount) || bystanderCount < INCLUDED_BYSTANDERS || bystanderCount > maximumBystanders) {
        throw new BookingFlowError("Choose a valid number of accompanying bystanders.", 400);
      }
      const servicePrice = Number(service.price ?? 0);
      const commissionPercentage = Number(hospital.commissionPercentage);
      if (!Number.isFinite(servicePrice) || servicePrice < 0 || !Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
        throw new BookingFlowError("This package cannot be booked until its pricing is reviewed.", 409);
      }

      const recipients = await bookingNotificationRecipients(transaction, firestore, hospitalId);
      const bookingReference = await reserveBookingReference(transaction, firestore, bookingId);
      const auditReference = firestore.collection("auditLogs").doc();
      const now = FieldValue.serverTimestamp();
      const additionalBystanderTotal = (bystanderCount - INCLUDED_BYSTANDERS) * bystanderPolicy.additionalBystanderCharge;
      const bookingData = {
        bookingReference,
        consumerId: uid,
        consumerName: String(profile.name ?? "").trim(),
        consumerEmail: String(profile.email ?? "").trim().toLowerCase(),
        consumerPhone: profile.phone.trim(),
        consumerAddress: typeof profile.address === "string" ? profile.address.trim() || null : null,
        hospitalId,
        serviceId,
        hospitalName: String(hospital.name ?? "").trim(),
        hospitalLocation: [hospital.city, hospital.district, hospital.state].filter(Boolean).join(", "),
        serviceName: packageTitle(service),
        preferredDate: Timestamp.fromDate(preferredDate),
        preferredEndDate: preferredEndDateText ? Timestamp.fromDate(preferredEndDate) : null,
        preferredTime: "Flexible",
        bystanderCount,
        additionalBystanderCharge: bystanderPolicy.additionalBystanderCharge,
        additionalBystanderTotal,
        confirmedDate: Timestamp.fromDate(preferredDate),
        confirmedTime: null,
        status: "confirmed",
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
        confirmedAt: now,
        completedAt: null,
        treatmentStartedAt: null,
        treatmentCompletedAt: null,
        bookingTermsAcceptedAt: now,
        bookingTermsVersion: BOOKING_TERMS_VERSION,
        lastAuditId: auditReference.id,
      };
      transaction.create(bookingDocument, bookingData);
      transaction.create(auditReference, {
        action: "create", module: "bookings", recordId: bookingId,
        actorId: uid, actorRole: "consumer", previousValues: null, updatedValues: bookingData,
        timestamp: now, source: "server",
        device: requestAuditDevice(request),
      });
      addBookingNotifications(transaction, firestore, {
        recipients, documentId: bookingId, bookingReference, hospitalName: bookingData.hospitalName,
        consumerName: bookingData.consumerName, consumerPhone: bookingData.consumerPhone,
        serviceName: bookingData.serviceName, preferredDate, preferredEndDate, bystanderCount,
        actorId: uid, auditId: auditReference.id, now,
      });
      return { duplicate: false, bookingReference, confirmation: bookingData };
    });
    const canonical = result.bookingReference || await ensureBookingReference(firestore, bookingId, { uid, role: "consumer" }, request);
    if (!result.duplicate && result.confirmation) scheduleBookingConfirmation("hospital", bookingId, result.confirmation);
    return apiJson({ ok: true, bookingId, bookingReference: canonical, duplicate: result.duplicate }, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof BookingFlowError) return apiJson({ error: error.message }, error.status);
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/consumer/bookings", error);
    return apiJson({ error: "We could not place your booking. Please try again." }, 503);
  }
}
