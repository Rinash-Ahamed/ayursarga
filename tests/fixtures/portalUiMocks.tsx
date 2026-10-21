import type { ReactNode } from "react";
import { CONSUMER_PRIVACY_NOTICE_VERSION, CUSTOMER_TERMS_VERSION } from "@/features/consumers/privacyConsent";

export const portalUiState = { screen: "admin-dashboard", calls: 0, bookingRequests: 0, cancelledBookings: 0, navigatedTo: "", unavailablePackage: false, availabilityReviews: [] as string[], holdAvailability: false, failAvailability: false, consultantWrites: [] as unknown[] };
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
export const hospital = { ...metadata, id: "centre", name: "Ayursarga Mother and Baby Ayurvedic Wellness Centre with a Long Name", legalName: "Ayursarga Wellness", email: "hospital.contact.with.long.address@example.com", phone: "9876543210", hospitalPhone1: "9876543210", address: "An extended address with locality and building information, Palakkad, Kerala", registeredAddress: "Palakkad, Kerala", city: "Palakkad", district: "Palakkad", state: "Kerala", description: "Care centre description", commissionPercentage: 20, status: "active", isPublic: true, contractStatus: "signed", contractUrl: "https://example.com/signed.pdf", contractGeneratedAt: now, contractSignedAt: now, activatedAt: now, imageUrls: ["https://images.test/hospital.webp"], imageUrl: null, facilities: [], legalPolicies: "Centre policy information" };
const services = [7, 14, 21].map((days) => ({ ...metadata, id: `package-${days}`, hospitalId: "centre", status: "active", name: `${days}-day package`, packageDurationDays: days, price: 24000, procedures: { headMassage: 3, hairPack: 2 }, description: "Package notes and information for patients." }));
const bookings = ["requested", "confirmed", "reschedule_requested"].map((status, index) => ({ ...metadata, id: `booking-${index}`, bookingReference: `AYUR00000${index}`, hospitalId: "centre", hospitalName: hospital.name, serviceName: "14-day package", consumerId: "patient", consumerName: "Patient With a Longer Display Name", consumerEmail: "patient.with.a.very.long.email.address@example.com", consumerPhone: "9876543210", consumerAddress: hospital.address, preferredDate: now, preferredTime: "10:00", price: 24000, servicePrice: 24000, status, treatmentStatus: "started", totalAmount: 24000, estimatedCommission: 4800 }));
const autoConfirmedBooking = { ...bookings[0], status: "confirmed", treatmentStatus: "not_started", preferredTime: "Flexible", confirmedDate: now, confirmedTime: null, confirmedAt: now };
const availability = ["pending", "blocked", "rejected"].map((status, index) => ({ ...metadata, id: `availability-${index}`, hospitalId: "centre", hospitalName: hospital.name, startDate: now, endDate: now, reason: "Maintenance and scheduled treatment availability information", status, source: "hospital" }));
const consultant = { ...metadata, id: "consultant", employeeId: "AS001", employeeSequence: 1, name: "Consultant With a Longer Name", email: hospital.email, contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS, MD", yearsExperience: 3.5, status: "active", lastWorkedCompany: "Ayurvedic Care Centre", address: hospital.address, emergencyContactNo: "9876543210" };
const user = { ...metadata, id: "actor", uid: "actor", name: hospital.name, email: hospital.email, role: "consumer", status: "active", phone: "9876543210", hospitalId: "centre", privacyConsentAt: now, privacyConsentVersion: CONSUMER_PRIVACY_NOTICE_VERSION, customerTermsAcceptedAt: now, customerTermsVersion: CUSTOMER_TERMS_VERSION };
const page = (documents: unknown[]) => Promise.resolve({ documents, cursor: null, hasMore: false });
const firebaseUser = { uid: "patient" };
export function useAuth() { return { firebaseUser, userProfile: { ...user, role: portalUiState.screen.startsWith("consumer") ? "consumer" : portalUiState.screen.startsWith("hospital") ? "hospital" : "admin" }, isLoading: false, error: null, refreshUserProfile: async () => user, logout: async () => {}, clearError: () => {}, login: async () => {}, reauthenticate: async () => {}, changePassword: async () => {} }; }
export function usePathname() {
  if (portalUiState.screen === "consumer-profile") return "/app/profile";
  if (portalUiState.screen === "consumer-support") return "/app/support";
  if (portalUiState.screen.startsWith("consumer-request")) return "/app/bookings/new";
  if (portalUiState.screen === "consumer-completion") return "/app/complete-profile";
  if (portalUiState.screen.startsWith("consumer")) return "/app/bookings";
  const paths: Record<string, string> = { "admin-dashboard": "/admin", "admin-hospitals": "/admin/hospitals", "admin-details": "/admin/hospitals/centre", "admin-consultants": "/admin/consultants", "admin-users": "/admin/users", "admin-bookings": "/admin/bookings", "admin-availability": "/admin/availability", "admin-audits": "/admin/audits", "hospital-dashboard": "/hospital", "hospital-profile": "/hospital/profile", "hospital-services": "/hospital/services", "hospital-bookings": "/hospital/bookings", "hospital-availability": "/hospital/availability", "hospital-password": "/hospital/change-password" };
  return paths[portalUiState.screen] ?? "/admin/login";
}
const router = { replace: (path: string) => { portalUiState.navigatedTo = path; }, push: () => {}, back: () => {} };
export function useRouter() { return router; }
export default function MockNextElement({ src, href, children, alt, width, height, ...props }: { src?: string; href?: string; children?: ReactNode; alt?: string; width?: number; height?: number; [key: string]: unknown }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt ?? ""} width={width} height={height} /> : <a href={href} {...props}>{children}</a>;
}
export const getHospital = async () => ({ ...hospital, facilities: "Free WiFi\nFree parking" });
export const getHospitalCapacity = async () => ({ ...metadata, id: "centre", hospitalId: "centre", totalRooms: 10, occupiedRooms: 4, status: "active" });
export const listAllHospitals = () => page([hospital]);
export const listHospitalServices = () => page(services);
const operationalBookings = () => bookings.map((booking, index) => index === 0 ? { ...booking, hospitalName: undefined, serviceName: undefined, serviceId: "package-14" } : booking);
export const listHospitalBookings = () => page(operationalBookings());
export const listConsumerBookings = () => page(bookings.map((booking, index) => ({ ...booking, serviceId: "package-14", hospitalName: index === 0 ? undefined : hospital.name, serviceName: index === 0 ? undefined : "14-day package", treatmentStatus: index === 0 ? "not_started" : "started", confirmedDate: index === 1 ? now : null, confirmedTime: index === 1 ? "10:30" : null, consumerNotes: "Please confirm room accessibility.", hospitalNotes: index === 1 ? "Your preferred care dates are available." : null, bystanderCount: 2, additionalBystanderTotal: 500 })));
export const getConsumerBookingDetails = async () => ({ details: { "booking-0": { hospitalName: hospital.name, serviceName: "14-day package", hospitalLocation: "Palakkad, Kerala" } } });
export const cancelConsumerBooking = async () => { portalUiState.cancelledBookings++; };
export const createBookingRequest = async () => { portalUiState.bookingRequests++; return { ok: true, bookingId: "booking-0", bookingReference: "AYUR000000" }; };
export const getPortalBooking = async (id: string) => portalUiState.screen.endsWith("auto-confirmed") && id === autoConfirmedBooking.id ? autoConfirmedBooking : bookings.find((booking) => booking.id === id) ?? null;
export const getPublicHospital = async () => ({ ...hospital, blockedDateRanges: (globalThis as unknown as { bookingSoldOut?: boolean }).bookingSoldOut ? [{ startDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")), endDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")) }] : [] });
export const getPublicHospitalService = async () => portalUiState.unavailablePackage ? null : services[1];
export const listAdminBookings = () => page(operationalBookings());
export const readDocumentsByIds = async (collectionPath: string, ids: string[]) => collectionPath === "hospitals" ? [hospital].filter((item) => ids.includes(item.id)) : collectionPath === "services" ? services.filter((item) => ids.includes(item.id)) : [];
export const listUsers = () => page([user]);
export const listConsultants = () => page([consultant]);
export const listHospitalAvailabilityRequests = () => page(availability);
export const listAdminAvailabilityRequests = () => page(availability);
export const listAuditLogs = () => page([{ ...metadata, id: "audit", timestamp: now, action: "update", module: "hospitals", recordId: "centre", actorId: "actor", actorRole: "admin", previousValues: { name: "Centre" }, updatedValues: { name: hospital.name }, source: "server" }]);
export const getUserDisplayNames = async () => new Map([["actor", "Admin"]]);
export const countDocuments = async () => 12;
export const sumDocuments = async () => 24000;
export const readDocument = async () => hospital;
export const emptyQueryPage = () => ({ documents: [], cursor: null, hasMore: false });
let notificationReceiver: ((items: unknown[]) => void) | null = null;
export const subscribeToNotifications = (_id: string, receive: (items: unknown[]) => void) => { notificationReceiver = receive; receive([{ ...metadata, id: "notification", title: "New booking AYUR000000", message: "Patient With a Longer Display Name · 14-day package · Booked, awaiting hospital confirmation", actionHref: `/${portalUiState.screen.startsWith("hospital") ? "hospital" : "admin"}/bookings?booking=booking-0`, readAt: null }]); return () => { notificationReceiver = null; }; };
export const clearAllNotifications = async () => { portalUiState.calls++; notificationReceiver?.([]); return { ok: true, clearedThrough: { seconds: now.seconds + 1, nanoseconds: 0 } }; };
export const buildHospitalContractPdf = () => ({ html: "<h1>Contract fixture</h1>", filename: "contract.pdf", blob: new Blob() });
export const authorizedApiRequest = async () => { portalUiState.calls++; return { imageUrls: [] }; };
export const updateHospital = async () => ({});
export const recordHospitalContractGeneration = async () => ({});
export const confirmHospitalContractSigning = async () => ({});
export const activateHospital = async () => ({});
export const deactivateHospital = async () => ({ status: "inactive" });
export const archiveHospital = async () => ({ status: "archived" });
export const createHospital = async () => ({});
export const sendHospitalLoginSetup = async () => "test@example.com";
export const updateHospitalProfile = async () => ({});
export const saveHospitalCapacity = async () => ({});
export const createService = async () => ({});
export const updateService = async () => ({});
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
export const updateTreatmentProgress = async () => ({});
export const archiveConsumer = async () => ({});
export const createConsultant = async (input: unknown) => { portalUiState.consultantWrites.push(input); return "AS002"; };
export const updateConsultant = async (_id: string, input: unknown) => { portalUiState.consultantWrites.push(input); return {}; };
export const updateUserProfile = async () => { portalUiState.calls++; };
export const setConsultantStatus = async () => ({});
export const clearAllAuditLogs = async () => 0;
export const markAllNotificationsRead = async () => {};
export const markNotificationRead = async () => {};
