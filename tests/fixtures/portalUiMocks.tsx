import { useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_CONSULTATION_CANCELLATION_POLICY, snapshotConsultationCancellation } from "@/features/consultations/cancellationPolicy";
import { ConsultationCheckoutClosedError } from "@/features/payments/checkout";
import { generateConsultationSlots } from "@/features/consultations/slots";
import type { PublicConsultant } from "@/features/consultations/types";
import type { ServiceDocument, TreatmentStatus } from "@/features/firestore/models";
import { CONSUMER_PRIVACY_NOTICE_VERSION, CUSTOMER_TERMS_VERSION } from "@/features/consumers/privacyConsent";
import { validateInvoiceInput, INVOICE_ISSUER, invoiceParty, type InvoiceInput, type CommissionInvoice } from "@/features/billing/invoices";
export { buildBrandedDocumentPdf } from "../../features/hospitals/contractPdf";

export const portalUiState = { screen: "admin-dashboard", calls: 0, bookingRequests: 0, bookingInputs: [] as unknown[], cancelledBookings: 0, navigatedTo: "", unavailablePackage: false, availabilityReviews: [] as string[], holdAvailability: false, failAvailability: false, consultantWrites: [] as unknown[], publicConsultantReads: 0, autoConfirmedTreatment: "not_started" as TreatmentStatus };
export const qaRequestTrace: { kind: string; args: unknown[] }[] = [];
Object.assign(globalThis, { qaRequestTrace });
export const auditMfaCalls = { reauth: [] as string[][], clears: 0 };
Object.assign(globalThis, { auditMfaCalls });
export let finishAvailabilityReview: (() => void) | undefined;
Object.assign(globalThis, { finishAvailabilityReview: () => finishAvailabilityReview?.() });
export class Timestamp {
  constructor(public seconds = 1_790_000_000, public nanoseconds = 0) {}
  toDate() { return new Date(this.seconds * 1000); }
  static now() { return new Timestamp(); }
  static fromDate(date: Date) { return new Timestamp(date.getTime() / 1000); }
}
const now = Timestamp.now();
const metadata = { createdAt: now, updatedAt: now, createdBy: "actor", updatedBy: "actor", archivedAt: null, archivedBy: null, lastAuditId: "audit" };
export const hospital = { ...metadata, id: "centre", hospitalCode: "AH001", hospitalSequence: 1, name: "Ayursarga Mother and Baby Ayurvedic Wellness Centre with a Long Name", legalName: "Ayursarga Wellness", email: "hospital.contact.with.long.address@example.com", phone: "9876543210", hospitalPhone1: "9876543210", address: "An extended address with locality and building information, Palakkad, Kerala", registeredAddress: "Palakkad, Kerala", city: "Palakkad", district: "Palakkad", state: "Kerala", description: "Care centre description", commissionPercentage: 20, status: "active", isPublic: true, contractStatus: "signed", contractUrl: "https://example.com/signed.pdf", contractGeneratedAt: now, contractSignedAt: now, activatedAt: now, imageUrls: ["https://images.test/hospital.webp"], imageUrl: null, facilities: [], legalPolicies: "Centre policy information" };
const services = [7, 14, 21].map((days) => ({ ...metadata, id: `package-${days}`, hospitalId: "centre", status: "active", name: `${days}-day package`, packageDurationDays: days, price: 24000, procedures: { headMassage: 3, hairPack: 2 }, description: "Package notes and information for patients." }));
const bookings = ["requested", "confirmed", "reschedule_requested"].map((status, index) => ({ ...metadata, id: `booking-${index}`, bookingReference: `AYUR00000${index}`, hospitalId: "centre", hospitalName: hospital.name, serviceName: "14-day package", consumerId: "patient", consumerName: "Patient With a Longer Display Name", consumerEmail: "patient.with.a.very.long.email.address@example.com", consumerPhone: "9876543210", consumerAddress: hospital.address, preferredDate: now, preferredTime: "10:00", price: 24000, servicePrice: 24000, status, treatmentStatus: "started", totalAmount: 24000, estimatedCommission: 4800 }));
const autoConfirmedBooking = { ...bookings[0], status: "confirmed", treatmentStatus: "not_started", preferredTime: "Flexible", confirmedDate: now, confirmedTime: null, confirmedAt: now };
const availability = ["pending", "blocked", "rejected"].map((status, index) => ({ ...metadata, id: `availability-${index}`, hospitalId: "centre", hospitalName: hospital.name, startDate: now, endDate: now, reason: "Maintenance and scheduled treatment availability information", status, source: "hospital" }));
const consultant = { ...metadata, id: "consultant", employeeId: "AS001", employeeSequence: 1, name: "Consultant With a Longer Name", email: hospital.email, contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS, MD", yearsExperience: 3.5, status: "active", lastWorkedCompany: "Ayurvedic Care Centre", address: hospital.address, emergencyContactNo: "9876543210" };
const user = { ...metadata, id: "actor", uid: "actor", name: hospital.name, email: hospital.email, role: "consumer", status: "active", phone: "9876543210", hospitalId: "centre", privacyConsentAt: now, privacyConsentVersion: CONSUMER_PRIVACY_NOTICE_VERSION, customerTermsAcceptedAt: now, customerTermsVersion: CUSTOMER_TERMS_VERSION };
const page = (documents: unknown[]) => Promise.resolve({ documents: portalUiState.screen.endsWith("-status-order") && documents.length
  ? Array.from({ length: 4 }, (_, index) => ({ ...documents[index % documents.length] as object, id: `order-${index}`, status: index % 2 ? "active" : "inactive" }))
  : documents, cursor: null, hasMore: false });
const firebaseUser = { uid: "patient" };
export const creationReads = { consultants: 0, packages: 0 };
Object.assign(globalThis, { creationReads });
export const listInvoices = async () => ({ documents: [], cursor: null, hasMore: false });
let issuedInvoice: CommissionInvoice | null = null;
export const createInvoice = async (input: InvoiceInput) => {
  portalUiState.calls++;
  issuedInvoice = { ...input, ...validateInvoiceInput(input).totals, id: "invoice-fixture", invoiceNumber: "AS/2026/00001", status: "issued", paidPaise: 0, paymentStatus: "unpaid", lastAuditId: "invoice-issued",
    issuer: INVOICE_ISSUER, billTo: invoiceParty(hospital) };
  return { invoice: issuedInvoice };
};
export const recordInvoicePayment = async (input: { amount: string; date: string; reference: string; notes: string }) => {
  if (!issuedInvoice) throw new Error("Invoice not found");
  const paidPaise = (issuedInvoice.paidPaise ?? 0) + Math.round(Number(input.amount) * 100);
  portalUiState.calls++;
  issuedInvoice = { ...issuedInvoice, paidPaise, paymentStatus: paidPaise === issuedInvoice.totalPaise ? "paid" : "partially_paid", lastAuditId: "receipt-audit",
    lastReceipt: { amountPaise: Math.round(Number(input.amount) * 100), date: input.date, reference: input.reference, notes: input.notes } };
  return { invoice: issuedInvoice };
};
export async function verifyPasswordAction(code: string) {
  if (code !== "valid-test-code") throw new Error("Invalid link");
}
export async function prepareAdminMfaEnrollment() { return { key: "SYNTHETICTESTKEY", email: "admin@example.test", qrUri: "otpauth://totp/Ayursarga:admin?secret=JBSWY3DPEHPK3PXP&issuer=Ayursarga" }; }
export async function requestAdminEmailVerification() {}
export async function completePasswordAction() {
  portalUiState.calls++;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
export function passwordActionError() { return "This password link is invalid, expired or already used. Request a new link to continue."; }
let authProcessing = false;
const authListeners = new Set<() => void>();
function subscribeAuthProcessing(listener: () => void) {
  authListeners.add(listener);
  return () => { authListeners.delete(listener); };
}
function setAuthProcessing(value: boolean) {
  authProcessing = value;
  authListeners.forEach((listener) => listener());
}
export function useAuth() {
  const processing = useSyncExternalStore(subscribeAuthProcessing, () => authProcessing, () => false);
  return { firebaseUser, userProfile: { ...user, role: portalUiState.screen.startsWith("consumer") ? "consumer" : portalUiState.screen.startsWith("hospital") ? "hospital" : "admin" }, isAuthenticated: false, status: "unauthenticated", isLoading: processing, error: null, refreshUserProfile: async () => user, logout: async () => {}, clearError: () => {}, login: async ({ password }: { password: string }) => { portalUiState.calls++; if (password === "invalid-test-password1") throw new Error("The email address or password is incorrect."); }, resetPassword: async () => {
    portalUiState.calls++;
    setAuthProcessing(true);
    try { await new Promise((resolve) => setTimeout(resolve, 100)); }
    finally { setAuthProcessing(false); }
  }, reauthenticate: async (...args: string[]) => { auditMfaCalls.reauth.push(args); }, changePassword: async () => {} };
}
export function usePathname() {
  if (portalUiState.screen.startsWith("admin-dashboard")) return "/admin";
  if (portalUiState.screen === "consumer-profile") return "/app/profile";
  if (portalUiState.screen === "consumer-support") return "/app/support";
  if (portalUiState.screen.startsWith("consumer-request")) return "/app/bookings/new";
  if (portalUiState.screen === "consumer-completion") return "/app/complete-profile";
  if (portalUiState.screen.startsWith("consumer")) return "/app/bookings";
  const paths: Record<string, string> = { "admin-dashboard": "/admin", "admin-hospitals": "/admin/hospitals", "admin-details": "/admin/hospitals/centre", "admin-consultants": "/admin/consultants", "admin-users": "/admin/users", "admin-bookings": "/admin/bookings", "admin-availability": "/admin/availability", "admin-audits": "/admin/audits", "hospital-dashboard": "/hospital", "hospital-profile": "/hospital/profile", "hospital-services": "/hospital/services", "hospital-bookings": "/hospital/bookings", "hospital-availability": "/hospital/availability", "hospital-password": "/hospital/change-password" };
  return paths[portalUiState.screen.replace(/-empty$/, "")] ?? "/admin/login";
}
const router = { replace: (path: string) => { portalUiState.navigatedTo = path; }, push: (path: string) => { portalUiState.navigatedTo = path; }, back: () => {} };
export function useRouter() { return router; }
export default function MockNextElement({ src, href, children, alt, width, height, ...props }: { src?: string; href?: string; children?: ReactNode; alt?: string; width?: number; height?: number; [key: string]: unknown }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt ?? ""} width={width} height={height} loading={props.loading as "lazy" | "eager" | undefined} onError={props.onError as () => void} /> : <a href={href} {...props}>{children}</a>;
}
const coverGallery = Array.from({ length: 6 }, (_, index) => `https://images.test/centre-${index}.webp`);
export const getHospital = async () => ({ ...hospital, imageUrls: portalUiState.screen === "admin-gallery-incomplete" ? coverGallery.slice(0, 3) : coverGallery, status: portalUiState.screen === "admin-gallery-incomplete" ? "pending" : hospital.status, isPublic: portalUiState.screen === "admin-gallery-incomplete" ? false : hospital.isPublic, facilities: "Free WiFi\nFree parking",
  ...(portalUiState.screen === "admin-contract-outdated" ? { status: "pending", isPublic: false, contractNeedsRegeneration: true,
    registrationNumber: "123456", cinNumber: "NOT APPLICABLE", panNumber: "ABCDE1234F", gstin: "NOT APPLICABLE",
    contractEffectiveDate: "2026-11-02", contractExpiryDate: "2029-11-02", emergencyContact: "9876543210", emergencyReferralHospital: "Nearby hospital" } : {}),
  ...(portalUiState.screen === "admin-email-request" ? { pendingOfficialEmail: "new.official.hospital.email.address@example.test" } : {}),
});
export const getHospitalCapacity = async () => ({ ...metadata, id: "centre", hospitalId: "centre", totalRooms: 10, occupiedRooms: 4, status: "active" });
export const listAllHospitals = () => page(portalUiState.screen === "admin-hospitals-empty" ? [] : portalUiState.screen === "admin-hospital-cards" ? Array.from({ length: 6 }, (_, index) => ({ ...hospital, id: `centre-${index}`, name: `${hospital.name} ${index + 1}` })) : [hospital]);
export const getHospitalPackageSummaries = async (ids: string[]) => {
  if ((globalThis as unknown as { packageSummaryFailure?: boolean }).packageSummaryFailure) throw new Error("Unavailable");
  return { summaries: Object.fromEntries(ids.map((id, index) => [id, { total: index === 1 ? 0 : 4, pending: index === 1 ? 0 : 1, approved: index === 1 ? 0 : 1, draft: index === 1 ? 0 : 1, changesRequested: index === 1 ? 0 : 1 }])) };
};
export const listHospitalServices = () => { creationReads.packages++; return page(portalUiState.screen === "hospital-services-empty" ? [] : portalUiState.screen.endsWith("package-review") ? services.map((service) => ({ ...service, status: "inactive", reviewStatus: portalUiState.screen.startsWith("admin") ? "pending" : "draft", publishedAt: null, draftPackage: { name: service.name, description: service.description, packageDurationDays: service.packageDurationDays, procedures: service.procedures, otherProcedures: [], price: 28000 } })) : services); };
const operationalBookings = () => bookings.map((booking, index) => index === 0 ? { ...booking, hospitalName: undefined, serviceName: undefined, serviceId: "package-14" } : booking);
export const listHospitalBookings = () => page(portalUiState.screen === "hospital-bookings-empty" ? [] : operationalBookings());
export const listConsumerBookings = () => page(portalUiState.screen === "consumer-bookings-empty" ? [] : bookings.map((booking, index) => ({ ...booking, serviceId: "package-14", hospitalName: index === 0 ? undefined : hospital.name, serviceName: index === 0 ? undefined : "14-day package", treatmentStatus: index === 0 ? "not_started" : "started", confirmedDate: index === 1 ? now : null, confirmedTime: index === 1 ? "10:30" : null, consumerNotes: "Please confirm room accessibility.", hospitalNotes: index === 1 ? "Your preferred care dates are available." : null, bystanderCount: 2, additionalBystanderTotal: 500 })));
export const getConsumerBookingDetails = async () => ({ details: { "booking-0": { hospitalName: hospital.name, serviceName: "14-day package", hospitalLocation: "Palakkad, Kerala" } } });
export const cancelHospitalBooking = async (_id: string, cancellationReason: string) => {
  portalUiState.cancelledBookings++;
  return { status: "cancelled" as const, cancellationReason, cancelledByRole: portalUiState.screen.startsWith("admin") ? "admin" as const : "consumer" as const,
    cancelledBy: "patient", cancelledAt: now, lastAuditId: "cancelled-audit" };
};
export const createBookingRequest = async (input: unknown) => { portalUiState.bookingRequests++; portalUiState.bookingInputs.push(input); return { ok: true, bookingId: "booking-0", bookingReference: "AYUR000000" }; };
export const getPortalBooking = async (id: string) => portalUiState.screen.endsWith("auto-confirmed") && id === autoConfirmedBooking.id
  ? { ...autoConfirmedBooking, treatmentStatus: portalUiState.autoConfirmedTreatment, status: portalUiState.autoConfirmedTreatment === "completed" ? "completed" : "confirmed" }
  : bookings.find((booking) => booking.id === id) ?? null;
export const getConsumerBooking = getPortalBooking;
export const getPublicHospital = async () => ({ ...hospital, blockedDateRanges: (globalThis as unknown as { bookingSoldOut?: boolean }).bookingSoldOut ? [{ startDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")), endDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")) }] : [] });
export const getPublicHospitalService = async () => portalUiState.unavailablePackage ? null : { ...services[1], packageVersion: "a".repeat(64) };
export const listAdminBookings = (filters: { status?: string } = {}, options: { cursor?: unknown } = {}) => {
  qaRequestTrace.push({kind:"bookings",args:[filters,options]});
  if(portalUiState.screen === "admin-bookings-pagination") {
    const records=operationalBookings().filter(b=>!filters.status||b.status===filters.status);
    return Promise.resolve({documents:options.cursor?records.slice(1):records.slice(0,1),cursor:options.cursor?null:"qa-next",hasMore:!options.cursor&&records.length>1});
  }
  return page(portalUiState.screen === "admin-bookings-empty" ? [] : portalUiState.screen === "admin-bookings-cancellable" ? [{ ...bookings[0], treatmentStatus: "not_started" }] : operationalBookings());
};
export const readDocumentsByIds = async (collectionPath: string, ids: string[]) => collectionPath === "hospitals" ? [hospital].filter((item) => ids.includes(item.id)) : collectionPath === "services" ? services.filter((item) => ids.includes(item.id)) : [];
export const userListControl = { failRole: "", holdRole: "", distinctNames: false, pending: [] as (() => void)[] };
Object.assign(globalThis, { userListControl });
export const listUsers = async (role: string) => {
  if (userListControl.failRole === role) throw new Error("Synthetic user-group failure");
  const result = await page(portalUiState.screen === "admin-users-empty" ? [] : Array.from({ length: portalUiState.screen === "admin-user-cards" ? 10 : 1 }, (_, index) => ({ ...user, id: `${user.id}-${index}`, role,
    ...(userListControl.distinctNames ? { name: `${role} account` } : {}),
    ...(portalUiState.screen === "admin-user-cards" ? { address: index === 0 ? `${hospital.address} ${"Long address and building details. ".repeat(12)}` : hospital.address } : {}), ...(portalUiState.screen === "admin-users-no-date" ? { createdAt: undefined } : {}) })));
  if (userListControl.holdRole === role) await new Promise<void>(resolve => userListControl.pending.push(resolve));
  return result;
};
export const consultantListState = { statuses: {} as Record<string, string> };
Object.assign(globalThis, { consultantListState });
export const listConsultants = (options?: { cursor?: unknown; status?: string }, search = "", service?: string) => {
  creationReads.consultants++;
  if(portalUiState.screen==='admin-consultants-filters'){
    qaRequestTrace.push({kind:'consultants',args:[options,search,service]});
    const documents=[1000,10,3,1,11,2].map(sequence=>({...consultant,id:`AS${String(sequence).padStart(3,'0')}`,employeeId:`AS${String(sequence).padStart(3,'0')}`,employeeSequence:sequence,
      name:`Consultant ${sequence}`,status:consultantListState.statuses[`AS${String(sequence).padStart(3,'0')}`]??([2,11].includes(sequence)?'inactive':'active'),
      consultationServices:[sequence===3||sequence===11?'psychologist':'prenatal-doctor']}))
      .filter(record=>(!options?.status||record.status===options.status)&&(!service||record.consultationServices.includes(service))
        &&(!search.trim()||record.employeeId.startsWith(search.trim().toUpperCase())||record.name.toLowerCase().startsWith(search.trim().toLowerCase())));
    return Promise.resolve({documents,cursor:null,hasMore:false});
  }
  if (portalUiState.screen === "admin-consultants-duplicates") {
    const record = (id: string) => ({ ...consultant, id, employeeId: id });
    return Promise.resolve(options?.cursor
      ? { documents: [record("AS002"), record("AS003"), record("AS003")], cursor: null, hasMore: false }
      : { documents: [record("AS002"), record("AS001"), record("AS002")], cursor: { phase: "current", document: null }, hasMore: true });
  }
    return page(portalUiState.screen === "admin-consultants-empty" ? [] : [{...consultant, ...(portalUiState.screen === "admin-consultants-schedule" ? {consultationServices:["prenatal-doctor","psychologist"]} : {})}]);
};
export const listHospitalAvailabilityRequests = () => page(portalUiState.screen === "hospital-availability-empty" ? [] : availability);
export const listAdminAvailabilityRequests = () => page(portalUiState.screen === "admin-availability-empty" ? [] : availability);
export const listAuditLogs = (options?: unknown) => {
  qaRequestTrace.push({kind:"audits",args:[options]});
  if(portalUiState.screen === "admin-audits-custom") return page(["2026-11-04T23:59:59+05:30","2026-11-05T00:00:00+05:30","2026-11-09T23:59:59+05:30","2026-11-10T00:00:00+05:30"].map((date,index)=>({...metadata,id:`date-audit-${index}`,timestamp:Timestamp.fromDate(new Date(date)),action:"update",module:"hospitals",recordId:"centre",actorId:"actor",actorRole:"admin",previousValues:null,updatedValues:{name:hospital.name},source:"server"})));
  return page(portalUiState.screen === "admin-audits-empty" ? [] : portalUiState.screen === "admin-security-audits" ? ["started", "completed", "unknown"].map(outcome => ({
  ...metadata, id: `security-${outcome}`, timestamp: now, action: "update", module: "adminSecurity", recordId: "actor", actorId: "actor", actorRole: "admin", previousValues: null,
  updatedValues: { event: "authenticator_replacement", outcome }, source: "web",
})) : [{ ...metadata, id: "audit", timestamp: now, action: "update", module: "hospitals", recordId: "centre", actorId: "actor", actorRole: "admin", previousValues: { name: "Centre" }, updatedValues: { name: hospital.name }, source: "server" }]); };
export const getUserDisplayNames = async () => new Map([["actor", "Admin"]]);
export const dashboardCountCalls: { path: string; filters: { field: string; operator: string; value: unknown }[] }[] = [];
Object.assign(globalThis, { dashboardCountCalls });
export const countDocuments = async (path: string, filters: { field: string; operator: string; value: unknown }[] = []) => {
  dashboardCountCalls.push({ path, filters });
  if (path === "consultationBookings") {
    if (portalUiState.screen === "admin-dashboard-consultations-unavailable") throw new Error("Simulated unavailable total");
    return portalUiState.screen === "admin-dashboard-consultations-zero" ? 0 : 5;
  }
  return 12;
};
export const sumDocuments = async () => 24000;
export const readDocument = async () => hospital;
export const emptyQueryPage = () => ({ documents: [], cursor: null, hasMore: false });
let notificationReceiver: ((items: unknown[], snapshot: { fromCache: boolean }) => void) | null = null;
export const subscribeToNotifications = (_id: string, receive: (items: unknown[], snapshot: { fromCache: boolean }) => void) => { notificationReceiver = receive; const inject = (event: Event) => receive((event as CustomEvent).detail, { fromCache: false }); window.addEventListener('portal-test-notifications', inject); receive([{ ...metadata, id: "notification", title: "New booking AYUR000000", message: "Patient With a Longer Display Name · 14-day package · Booked, awaiting hospital confirmation", actionHref: `/${portalUiState.screen.startsWith("hospital") ? "hospital" : "admin"}/bookings?booking=booking-0`, readAt: null }], { fromCache: false }); return () => { notificationReceiver = null; window.removeEventListener('portal-test-notifications', inject); }; };
export const clearAllNotifications = async () => { portalUiState.calls++; notificationReceiver?.([], { fromCache: false }); return { ok: true, clearedThrough: { seconds: now.seconds + 1, nanoseconds: 0 } }; };
export const buildHospitalContractPdf = () => ({ html: "<h1>Contract fixture</h1>", filename: "contract.pdf", blob: new Blob() });
export const authorizedApiRequest = async (url?: string, options?: RequestInit) => { portalUiState.calls++; return {
  ...(url?.endsWith("/image") ? { imageUrl: "https://images.test/consultant.webp" } : {}),
  imageUrls: url?.endsWith("/images") && options?.method === "PATCH" ? coverGallery.filter((image) => image !== JSON.parse(String(options.body)).imageUrl) : [] }; };
export const updateHospital = async (_id: string, changes: Record<string, unknown>) => { qaRequestTrace.push({kind:"hospital-update",args:[_id,changes]}); return changes; };
export const emailReviewCalls: boolean[] = [];
Object.assign(globalThis, { emailReviewCalls });
export const reviewHospitalEmail = async (_id: string, approve: boolean) => {
  emailReviewCalls.push(approve);
  return { pendingOfficialEmail: null, ...(approve ? { email: "new.official.hospital.email.address@example.test" } : {}) };
};
export const contractApprovalCalls: string[] = [];
Object.assign(globalThis, { contractApprovalCalls });
export const recordHospitalContractGeneration = async (_id: string, expectedContent: string) => {
  contractApprovalCalls.push(expectedContent);
  return portalUiState.screen === "admin-contract-outdated" ? { contractStatus: "generated", contractGeneratedAt: now, contractGeneratedContent: expectedContent, contractNeedsRegeneration: false } : {};
};
export const confirmHospitalContractSigning = async () => ({});
export const activateHospital = async () => ({});
export const deactivateHospital = async () => ({ status: "inactive" });
export const replaceAdminAuthenticator = async () => { throw new Error("Authenticator replacement is not performed by this layout fixture."); };
export const archiveHospital = async () => ({ status: "archived" });
export const createHospital = async () => {
  if ((globalThis as unknown as { duplicateCreation?: boolean }).duplicateCreation) throw Object.assign(new Error("This email is already used by a hospital. Open the existing record or use a different email."), { status: 409 });
  return {};
};
export const sendHospitalLoginSetup = async () => "test@example.com";
export const updateHospitalProfile = async (_id: string, changes: Record<string, unknown>) => ({ ...changes, email: hospital.email,
  ...(changes.email !== hospital.email ? { pendingOfficialEmail: changes.email } : {}) });
export const saveHospitalCapacity = async () => ({});
export const createService = async (input: object) => ({ serviceId: "new-package", service: { ...metadata, ...input, id: "new-package", name: "10-day package", status: "inactive", reviewStatus: "draft", draftPackage: input } });
export const updateService = async () => ({});
export const submitService = async () => { portalUiState.calls++; return { reviewStatus: "pending", lastAuditId: "submitted-audit" }; };
export const reviewHospitalPackages = async (_hospitalId: string, packages: { id: string; auditId: string }[], action: "approve" | "request_changes", reason: string) => {
  portalUiState.calls++;
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { packages: Object.fromEntries(packages.map(({ id }) => [id, action === "approve"
    ? { reviewStatus: "approved", status: "active", draftPackage: null, price: 28000, publishedAt: now }
    : { reviewStatus: "changes_requested", reviewNote: reason }])) as Record<string, Partial<ServiceDocument>> };
};
export const archiveService = async () => ({});
export const requestAvailabilityBlock = async () => ({});
export const createAdminAvailabilityBlock = async () => ({});
export const reviewAvailabilityRequest = async (_item: unknown, action: string) => {
  portalUiState.availabilityReviews.push(action);
  if (portalUiState.holdAvailability) await new Promise<void>((resolve) => { finishAvailabilityReview = resolve; });
  if (portalUiState.failAvailability) throw new Error("Availability review failed. Try again.");
  return {};
};
export const updateHospitalBooking = async () => ({});
export const updateTreatmentProgress = async (_id: string, treatmentStatus: TreatmentStatus) => {
  portalUiState.calls++;
  if (_id === autoConfirmedBooking.id) portalUiState.autoConfirmedTreatment = treatmentStatus;
  return { treatmentStatus, status: treatmentStatus === "completed" ? "completed" : "confirmed" };
};
export const userStatusCalls: string[] = [];
Object.assign(globalThis, { userStatusCalls });
export const setUserAccountStatus = async (_user: unknown, status: string) => {
  userStatusCalls.push(status);
  if ((globalThis as unknown as { failUserStatus?: boolean }).failUserStatus) throw new Error("Account update failed. Try again.");
  return { status, lastAuditId: `status-${userStatusCalls.length}` };
};
export const createConsultant = async (input: unknown) => {
  if ((globalThis as unknown as { duplicateCreation?: boolean }).duplicateCreation) throw Object.assign(new Error("This email is already used by a consultant. Open the existing record or use a different email."), { status: 409 });
  portalUiState.consultantWrites.push(input); return { employeeId: "AS002", consultant: { ...consultant, ...input as object, id: "AS002", employeeId: "AS002", employeeSequence: 2 } };
};
export const updateConsultant = async (_id: string, input: unknown) => { portalUiState.consultantWrites.push(input); if (input && typeof input === "object") Object.assign(consultant, input, { lastAuditId: "edited-consultant-audit" }); return { ok: true, lastAuditId: "edited-consultant-audit" }; };
export const consultantPhotoUploads: { id: string; name: string; expected?: string | null }[] = [];
Object.assign(globalThis, { consultantPhotoUploads });
export const uploadConsultantPhoto = async (id: string, file: File, expected?: string | null) => {
  consultantPhotoUploads.push({ id, name: file.name, expected });
  if ((globalThis as unknown as { failConsultantPhoto?: boolean }).failConsultantPhoto) throw new Error("Photo unavailable.");
  return `https://firebasestorage.googleapis.com/v0/b/test/o/consultants%2F${id}%2Fimages%2F00000000-0000-0000-0000-000000000001.webp?alt=media&token=test`;
};
export const updateUserProfile = async () => { portalUiState.calls++; };
export const setConsultantStatus = async (id: string, status: string) => { if(portalUiState.screen==='admin-consultants-filters')consultantListState.statuses[id]=status; return { ok: true, lastAuditId: "status-consultant-audit" }; };
export const clearAllAuditLogs = async () => { auditMfaCalls.clears++; return 0; };
export const markAllNotificationsRead = async () => {};
export const markNotificationRead = async () => {};

const consultationProfessional: PublicConsultant = { id: "AS001", name: "Assigned Consultation Professional", designation: "Ayurvedic physician", qualification: "BAMS, MD", yearsExperience: 3.5,
  consultantCharge: 990.55, preferredTimeSlots: ["morning"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" } } };
const consultation = { ...metadata, id: "consultation-fixture", bookingReference: "AYURCONS01", serviceId: "prenatal-doctor", serviceName: "Prenatal doctor consultation",
  consultantId: "AS001", consultantName: consultationProfessional.name, consultantDesignation: consultationProfessional.designation, consultantCharge: 900.5,
  consumerId: "patient", consumerName: "Patient With a Longer Display Name", consumerEmail: "patient@example.com", consumerPhone: "9876543210",
  preferredDate: "2099-10-25", preferredTimeSlot: "morning", slotStartTime: "09:30", slotEndTime: "11:45", status: "confirmed", confirmedDate: "2099-10-25", confirmedTime: null, confirmedAt: now,
  consumerNotes: "Guidance about pregnancy lifestyle", adminNotes: null, paymentStatus: "paid", paymentReference: "pay_fixture_private_reference" };
export const listPublicConsultants = async (_service?: string, cursor: number | null = null) => {
  if (consultantDiscovery.fail) throw new Error("Consultants unavailable");
  if (consultantDiscovery.paginated && cursor) return { documents: [secondConsultationProfessional], cursor: 2, hasMore: false };
  if (portalUiState.screen === "consumer-consultation-no-designation") return page([{ ...consultationProfessional, designation: "   ", qualification: "BAMS" }]);
  if (portalUiState.screen === "consumer-consultation-photo") return page([{ ...consultationProfessional, name: "Shafna", designation: "BAMS", qualification: "BAMS", yearsExperience: 3, consultantCharge: 300, imageUrl: "https://images.test/consultant.webp" }]);
  const staleFirstRead = portalUiState.screen === "consumer-consultation-refresh" && portalUiState.publicConsultantReads++ === 0;
  const result = await page(portalUiState.screen === "consumer-consultation-empty" || staleFirstRead ? [] : [portalUiState.screen.endsWith("-restricted")
    ? { ...consultationProfessional, preferredDays: ["sun"], availableDates: ["2099-10-25"] } : consultationProfessional]);
  return { ...result, cursor: consultantDiscovery.paginated ? 1 : null, hasMore: consultantDiscovery.paginated };
};
export const consultantDiscovery = { paginated: false, fail: false };
Object.assign(globalThis, { consultantDiscovery });
const secondConsultationProfessional = { ...consultationProfessional, id: "AS002", name: "Second Available Professional", consultantCharge: 1200, preferredSlotTimings: { morning: { startTime: "10:30", endTime: "12:00" } } };
export const getPublicConsultant = async (): Promise<PublicConsultant> => portalUiState.screen.endsWith("-restricted")
  ? { ...consultationProfessional, preferredDays: ["sun"], availableDates: ["2099-10-25"] } : consultationProfessional;
export const availabilityReads: string[] = [];
export const availabilityScenario = { paginated:false, fail:false, holdDate:"", release:null as (() => void) | null };
Object.assign(globalThis, { availabilityReads, availabilityScenario });
export const listConsultationAvailability = async (service:string, date:string, cursor:number|null = null) => {
  availabilityReads.push(`${service}:${date}:${cursor ?? "first"}`);
  if (availabilityScenario.holdDate === date) await new Promise<void>(resolve => { availabilityScenario.release=resolve; });
  if (availabilityScenario.fail) throw new Error("Availability unavailable");
  const source = await listPublicConsultants();
  const providers = (availabilityScenario.paginated && cursor
    ? [{...consultationProfessional,id:"AS002",name:"Second Available Professional",consultantCharge:1200,preferredSlotTimings:{morning:{startTime:"10:30",endTime:"12:00"}}}]
    : source.documents) as PublicConsultant[];
  return {documents:providers.map(provider => ({...provider,availabilityDate:date,availabilityService:service,availableSlots:generateConsultationSlots(date,service,provider)})).filter(provider => provider.availableSlots.length), cursor:availabilityScenario.paginated ? 1 : null,hasMore:availabilityScenario.paginated && !cursor};
};
export const slotReads = { calls: 0, hold: false, holdDate: "", fail: false, unavailableStart: "", finish: null as (() => void) | null };
Object.assign(globalThis, { slotReads });
export const listConsultationSlots = async (consultantId:string, service:string, date:string) => {
  slotReads.calls++;
  if (slotReads.hold || slotReads.holdDate === date) await new Promise<void>(resolve => { slotReads.finish = resolve; });
  if (slotReads.fail) throw new Error("Appointment times could not be checked. Please try again.");
  return {slots:generateConsultationSlots(date, service, consultantId === "AS002" ? secondConsultationProfessional : await getPublicConsultant()).filter(slot => slot.startTime !== slotReads.unavailableStart).map((slot,index)=>({...slot,status:portalUiState.screen === "admin-consultants-schedule" ? index === 0 ? "booked" as const : index === 1 ? "reserved" as const : "available" as const : "available" as const})),checkedAt:new Date().toISOString(),holdMinutes:10};
};
export const paymentRecovery = { closeNext: false, failNext: false };
Object.assign(globalThis, { paymentRecovery });
export const getConsultationCancellationPolicy = async () => ({ policy: { ...DEFAULT_CONSULTATION_CANCELLATION_POLICY, conditions: "Exceptional circumstances require support review." } });
export const saveConsultationCancellationPolicy = async (policy: object) => { portalUiState.calls++; return { policy: { ...policy, version: "saved-policy" } }; };
const financeRecord = { id: "consultation-fixture", bookingId: "consultation-fixture", bookingReference: "AYURCONS01", consultantId: "AS001",
  consultantName: "Assigned Consultation Professional", consumerName: "Patient With a Longer Display Name", serviceName: "Prenatal doctor consultation",
  paymentId: "pay_Test", orderId: "order_Test", mode: "test", grossPaise: 99055, commissionPaise: 9005, consultantPayablePaise: 90050,
  commissionPercentage: 10, gatewayFeePaise: 234, gatewayTaxPaise: 36, refundedPaise: 0, netSettlementPaise: 98821, netRevenuePaise: 8771,
  paymentStatus: "paid", settlementStatus: "pending", settlementHold: false, reviewReason: null, settlementReference: null,
  createdAt: "2026-10-31T10:00:00Z", updatedAt: "2026-10-31T10:00:00Z", lastAuditId: "finance-audit" };
export const listConsultantFinance = async (mode?: string, cursor?: string | null) => {
  qaRequestTrace.push({kind:"finance",args:[mode,cursor]});
  if(portalUiState.screen === "admin-consultant-finance-pagination") return {documents:cursor?[{...financeRecord,id:"finance-next",bookingReference:"AYURNEXT02",settlementStatus:"paid",mode}]:[{...financeRecord,mode}],mode,cursor:cursor?null:"qa-next",hasMore:!cursor,summary:{count:2,grossPaise:198110,commissionPaise:18010,gatewayFeePaise:468,refundedPaise:0,pendingPayablePaise:90050,paidPayablePaise:90050,reviewCount:0,unknownFeeCount:0}};
  if (portalUiState.screen === "admin-consultant-finance-refund" && financeRecord.settlementStatus !== "closed") Object.assign(financeRecord, { settlementHold: true, reviewReason: "refund_review", refundedPaise: financeRecord.grossPaise, paymentStatus: "refunded" });
  return { documents: [financeRecord], mode: "test", cursor: null, hasMore: false,
      summary: { count: 1, grossPaise: 99055, commissionPaise: 9005, gatewayFeePaise: 234, refundedPaise: financeRecord.refundedPaise, pendingPayablePaise: financeRecord.settlementStatus === "paid" || financeRecord.settlementStatus === "closed" || financeRecord.settlementHold ? 0 : 90050, paidPayablePaise: financeRecord.settlementStatus === "paid" ? 90050 : 0, reviewCount: financeRecord.settlementHold ? 1 : 0, unknownFeeCount: 0 } };
};
export const recordConsultantSettlement = async (input: { status: string; reference: string; date: string; notes: string }) => {
  portalUiState.calls++; Object.assign(financeRecord, { settlementStatus: input.status, settlementReference: input.reference, settlementDate: input.date, settlementNotes: input.notes }); return { record: { ...financeRecord } };
};
export const closeConsultantRefundReview = async (input: { notes: string }) => {
  portalUiState.calls++; Object.assign(financeRecord, { settlementStatus: "closed", settlementHold: false, reviewResolution: "full_refund_verified", reviewResolvedAt: "2026-11-02T10:00:00Z", reviewResolutionNotes: input.notes });
  return { record: { ...financeRecord } };
};
export const createConsultationBooking = async (input: unknown) => { portalUiState.consultantWrites.push(input); if (paymentRecovery.closeNext) { paymentRecovery.closeNext = false; throw new ConsultationCheckoutClosedError(); } if (paymentRecovery.failNext) { paymentRecovery.failNext = false; throw new Error("Payment could not be confirmed. Check My Bookings before paying again."); } return { ok: true, bookingId: "consultation-fixture", bookingReference: "AYURCONS01" }; };
export const listConsultationBookings = (_consumerId?: string|null, cursor?: unknown) => {
  qaRequestTrace.push({kind:"consultations",args:[_consumerId,cursor]});
  if(portalUiState.screen === "admin-consultations-pagination") return Promise.resolve({documents:[{...consultation,id:cursor?"consultation-next":consultation.id,bookingReference:cursor?"AYURNEXT03":consultation.bookingReference}],cursor:cursor?null:"qa-next",hasMore:!cursor});
  return page(portalUiState.screen === "admin-consultations-grid" ? Array.from({ length: 3 }, (_, index) => ({ ...consultation, id: `consultation-${index}`, bookingReference: `AYURGRID${index}`, consumerName: index === 0 ? "A consumer with a longer full name for wrapping" : consultation.consumerName })) : portalUiState.screen === "consumer-consultations-empty" ? [] : [{ ...consultation,
  ...(portalUiState.screen.startsWith("admin-consultations-refund") ? { paymentIntentId: consultation.id, paymentTotals: { paidPaise: 99055, refundedPaise: 0 } } : {}),
  ...(portalUiState.screen === "consumer-consultations-rescheduled" ? { consumerRescheduleCount: 1 } : {}),
  ...(portalUiState.screen === "consumer-consultations-policy" || portalUiState.screen === "consumer-consultations-expired" ? {
    cancellationPolicy: snapshotConsultationCancellation(DEFAULT_CONSULTATION_CANCELLATION_POLICY, portalUiState.screen.endsWith("expired") ? "2000-01-01" : "2099-10-25", "09:30"),
    paymentTotals: { paidPaise: 99055, refundedPaise: 0 },
  } : {}) }]); };
export const getConsultationBooking = async () => consultation;
export const getConsultationRefundQuote = async (bookingId: string) => ({ bookingId, lastAuditId: "consultation-audit", maximumPaise: 99055,
  suggestedPaise: portalUiState.screen.endsWith("exception") ? 0 : 99055, exceptionRequired: portalUiState.screen.endsWith("exception"), blocked: null });
export const submitConsultationRefund = async (input: { action: "refund" | "check"; amountPaise?: number }) => {
  portalUiState.consultantWrites.push(input);
  await Promise.resolve();
  return { status: "cancelled", lastAuditId: "refund-saved", refundSummary: {
    status: input.action === "check" ? "refunded" : portalUiState.screen.endsWith("unknown") ? "unknown" : "initiated",
    amountPaise: input.amountPaise ?? 99055, reference: "rfnd_Fixture", bankReference: null, requestedAt: "2026-11-04T06:00:00Z", updatedAt: "2026-11-04T06:00:00Z" } };
};
export const updateConsultationBooking = async (_id: string, input: { action: string; confirmedDate?: string; confirmedTime?: string; adminNotes?: string; cancellationReason?: string; rescheduleReason?: string }) => {
  portalUiState.consultantWrites.push(input);
  await Promise.resolve();
  return { changes: { ...input, ...(input.action === "reschedule" ? { rescheduledByRole: portalUiState.screen.startsWith("admin") ? "admin" as const : "consumer" as const, rescheduledBy: "patient", rescheduledAt: now } : {}), ...(input.action === "cancelled" ? { cancelledByRole: portalUiState.screen.startsWith("admin") ? "admin" as const : "consumer" as const } : {}), ...(input.action === "reschedule" ? {confirmedEndTime:generateConsultationSlots(input.confirmedDate!, consultation.serviceId, consultationProfessional).find(slot=>slot.startTime===input.confirmedTime)?.endTime, ...(portalUiState.screen.startsWith("consumer") ? {consumerRescheduleCount:1} : {})} : {}), status: input.action === "reschedule" ? "confirmed" : input.action, lastAuditId: "consultation-updated" },
    email: input.action !== "completed" ? { status: portalUiState.screen === "admin-consultations-email-failure" ? "failed" : "accepted" } : undefined,
    consultantEmail: input.action !== "completed" ? { status: portalUiState.screen === "admin-consultations-consultant-email-failure" ? "failed" : "accepted" } : undefined };
};
