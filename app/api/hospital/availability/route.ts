import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/hospital/availability", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

function parseDate(value: unknown) {
  const dateValue = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T00:00:00+05:30`)
    : new Date(Number.NaN);
}

function indiaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function device(request: Request) {
  return {
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    platform: null,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  };
}

export async function POST(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "hospital-availability"), 20, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many availability requests were sent. Please wait and try again." }, 429);
    }
    const { uid, profile, firestore } = await requireActiveUser(request, ["hospital"]);
    const hospitalId = String(profile.hospitalId ?? "").trim();
    if (!hospitalId) return apiJson({ error: "Your hospital account is not connected correctly." }, 403);
    const body = await readJsonBody(request, 4_000) as Record<string, unknown> | null;
    const startValue = String(body?.startDate ?? "").trim();
    const endValue = String(body?.endDate ?? "").trim();
    const startDate = parseDate(startValue);
    const endDate = parseDate(endValue);
    const reason = String(body?.reason ?? "").trim();
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return apiJson({ error: "Choose a valid availability date range." }, 400);
    }
    const maximumEnd = new Date(`${startValue}T00:00:00.000Z`);
    maximumEnd.setUTCFullYear(maximumEnd.getUTCFullYear() + 1);
    if (startValue < indiaDateKey(new Date()) || endValue > maximumEnd.toISOString().slice(0, 10)) {
      return apiJson({ error: "Choose dates from today onwards and within one year." }, 400);
    }
    if (reason.length < 3 || reason.length > 500) return apiJson({ error: "Enter a short reason between 3 and 500 characters." }, 400);

    const [hospitalSnapshot, adminSnapshot] = await Promise.all([
      firestore.collection("hospitals").doc(hospitalId).get(),
      firestore.collection("users").where("role", "==", "admin").get(),
    ]);
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || hospital?.status !== "active") {
      return apiJson({ error: "Your hospital is not currently available for this request." }, 409);
    }
    const adminIds = adminSnapshot.docs
      .filter((item) => item.data().status === "active")
      .map((item) => item.id);
    const availabilityReference = firestore.collection("availability").doc();
    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const availabilityData = {
      hospitalId,
      hospitalName: String(hospital.name ?? profile.name ?? "Hospital"),
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      reason,
      source: "hospital_portal",
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      createdAt: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    };
    const batch = firestore.batch();
    batch.set(availabilityReference, availabilityData);
    batch.set(auditReference, {
      action: "create", module: "availability", recordId: availabilityReference.id,
      actorId: uid, actorRole: "hospital", previousValues: null, updatedValues: availabilityData,
      timestamp: now, source: "server", device: device(request),
    });
    adminIds.forEach((recipientId) => {
      const notification = firestore.collection("notifications").doc();
      batch.set(notification, {
        recipientId,
        recipientRole: "admin",
        type: "availability_requested",
        title: "Availability block requested",
        message: `${availabilityData.hospitalName} requested ${dateLabel(startDate)} to ${dateLabel(endDate)} to be blocked.`,
        actionHref: "/admin/availability",
        recordId: availabilityReference.id,
        readAt: null,
        status: "active",
        createdAt: now,
        createdBy: uid,
        updatedAt: now,
        updatedBy: uid,
        archivedAt: null,
        archivedBy: null,
        lastAuditId: auditReference.id,
      });
    });
    await batch.commit();
    return apiJson({ ok: true, availabilityId: availabilityReference.id }, 201);
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/hospital/availability", error);
    return apiJson({ error: "We could not send the availability request. Please try again." }, 503);
  }
}
