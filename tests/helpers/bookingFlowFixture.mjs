import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { loadTypeScript } from "./loadTypeScript.mjs";

export class BookingTestAuthorizationError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Transactional in-memory fixture: no Firebase credentials, rules bypasses or
// live writes. Serializes conflicting transactions and stages atomic commits.
export function bookingFlowFixture(options = {}) {
  const versions = loadTypeScript("features/consumers/privacyConsent.ts");
  const records = new Map(Object.entries({
    "users/admin": { role: "admin", status: "active" },
    "users/partner": { role: "hospital", hospitalId: "centre", status: "active" },
    "users/another-partner": { role: "hospital", hospitalId: "different-centre", status: "active" },
    "users/inactive": { role: "admin", status: "inactive" },
    "hospitals/centre": { name: "Trusted centre", city: "Kochi", state: "Kerala", status: "active", isPublic: true, commissionPercentage: 10 },
    "services/package": { name: "Care", hospitalId: "centre", packageDurationDays: 7, status: "active", price: 12000 },
    ...(options.records ?? {}),
  }));
  const actor = { uid: "patient", role: "consumer", ...options.actor };
  const profile = { name: "Patient", email: "patient@example.com", phone: "9876543210", hospitalId: actor.role === "hospital" ? "centre" : null,
    privacyConsentVersion: versions.CONSUMER_PRIVACY_NOTICE_VERSION, customerTermsVersion: versions.CUSTOMER_TERMS_VERSION,
    privacyConsentAt: {}, customerTermsAcceptedAt: {}, ...options.profile };
  let sequence = Math.max(0, ...[...records.keys()].map((path) => Number(/\/auto-(\d+)$/.exec(path)?.[1] ?? 0)));
  let queue = Promise.resolve();
  let throwAfterCommit = options.throwAfterCommit ?? false;
  const calls = { commits: 0, writes: [], fields: [], emails: [], smtp: [], consultantSmtp: [] };
  const snapshot = (ref) => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => records.get(ref.path), updateTime: Timestamp.now() });
  const firestore = {
    collection: (collection) => {
      const buildQuery = (filters = [], maximum = 100) => ({
        where: (field, operator, value) => buildQuery([...filters, { field, operator, value }], maximum),
        limit: (value) => buildQuery(filters, value),
        get: async () => {
          const docs = [...records].filter(([path, data]) => path.startsWith(`${collection}/`) && filters.every(({ field, value }) => data[field] === value))
            .slice(0, maximum).map(([path]) => snapshot({ id: path.split("/")[1], path }));
          return { docs, size: docs.length };
        },
      });
      return { ...buildQuery(), doc: (id = `auto-${++sequence}`) => {
        const ref = { id, path: `${collection}/${id}` };
        ref.get = async () => snapshot(ref);
        return ref;
      } };
    },
    getAll: async (...args) => {
      if (args.at(-1)?.fieldMask) calls.fields.push(args.pop().fieldMask);
      return args.map(snapshot);
    },
    runTransaction: async (callback) => {
      let release;
      const wait = queue;
      queue = new Promise((resolve) => { release = resolve; });
      await wait;
      const pending = [];
      let wrote = false;
      const transaction = {
        get: async (ref) => { if (wrote) throw new Error("Read after transaction write"); return ref.path ? snapshot(ref) : ref.get(); },
        getAll: async (...refs) => { if (wrote) throw new Error("Read after transaction write"); return refs.map(snapshot); },
        create: (ref, data) => { wrote = true; pending.push({ type: "create", ref, data }); },
        set: (ref, data) => { wrote = true; pending.push({ type: "set", ref, data }); },
        update: (ref, data) => { wrote = true; pending.push({ type: "update", ref, data }); },
      };
      try {
        const result = await callback(transaction);
        if (options.failCommit) throw new Error("Simulated commit failure");
        if (options.failEmailOutcomeCommit && pending.some((entry) => entry.ref.path.startsWith("consultationEmailEvents/") && ["accepted", "failed"].includes(entry.data.status))) throw new Error("Simulated delivery acknowledgement failure");
        for (const entry of pending) if (entry.type === "create" && records.has(entry.ref.path)) throw new Error("Duplicate document creation");
        for (const entry of pending) records.set(entry.ref.path, entry.type === "update" ? { ...records.get(entry.ref.path), ...entry.data } : entry.data);
        calls.writes.push(...pending);
        calls.commits++;
        if (throwAfterCommit) { throwAfterCommit = false; throw new Error("Simulated lost commit response"); }
        return result;
      } finally { release(); }
    },
  };
  const overrides = {
    "@/services/auth/authEmailService": { authEmailSiteUrl: () => "https://ayursarga.com" },
    "@/services/email/emailService": { sendEmail: async (message) => {
      const events = [...records.values()].filter((record) => record.status === "sending" && record.payload);
      const event = events.find((record) => record.recipient === message.to);
      if (!event) throw new Error("Consultation SMTP must follow a committed claim");
      const consultant = event.audience === "consultant";
      (consultant ? calls.consultantSmtp : calls.smtp).push(message);
      if (consultant ? options.failConsultantEmail : options.failEmail) throw new Error("Simulated SMTP failure");
    } },
    "@/services/email/bookingEmailService": { scheduleBookingConfirmation: (kind, bookingId, booking) => {
      if (!calls.commits || records.get(`${kind === "hospital" ? "bookings" : "consultationBookings"}/${bookingId}`)?.status !== "confirmed") throw new Error("Email must follow a committed confirmation");
      calls.emails.push({ kind, bookingId, booking });
    } },
    "node:crypto": { ...crypto, randomInt: options.randomInt ?? crypto.randomInt },
    "@/services/firebase/adminAuthorization": {
      AdminAuthorizationError: BookingTestAuthorizationError,
      requireActiveUser: async (_request, allowed) => {
        if (options.denied || (allowed && !allowed.includes(actor.role))) throw new BookingTestAuthorizationError("Denied", 403);
        return { ...actor, profile, firestore };
      },
    },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } }), logApiError: () => {} },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "test" },
  };
  return { actor, profile, firestore, records, calls,
    load: (path) => loadTypeScript(path, overrides),
    values: (collection) => [...records].filter(([path]) => path.startsWith(`${collection}/`)).map(([path, data]) => ({ id: path.split("/")[1], ...data })),
  };
}

export function bookingTestRequest(path, body) {
  return new Request(`https://test.local${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export const validBookingInput = { hospitalId: "centre", serviceId: "package", requestId: "valid-request-identifier", preferredDate: "2099-10-25", bystanderCount: 1, bookingTermsAccepted: true };
