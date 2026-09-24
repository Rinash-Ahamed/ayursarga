import type { Timestamp } from "firebase/firestore";
import type { PortalRole, UserStatus } from "@/features/auth/contracts";

type RecordStatus = "active" | "inactive" | "pending" | "archived";

type AuditedDocument = {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  archivedAt: Timestamp | null;
  archivedBy: string | null;
  lastAuditId: string;
};

export type UserDocument = AuditedDocument & {
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: PortalRole;
  status: UserStatus;
  hospitalId: string | null;
  privacyConsentAt?: Timestamp | null;
  privacyConsentVersion?: string | null;
  customerTermsAcceptedAt?: Timestamp | null;
  customerTermsVersion?: string | null;
};

export type CentreGuidelineId =
  | "visitors"
  | "quietEnvironment"
  | "foodAndBeverages"
  | "prohibitedActivities"
  | "privacyAndPhotography"
  | "cleanliness"
  | "propertyDamage"
  | "ayurvedicTherapies"
  | "medicationsAndCharges"
  | "reportConcerns"
  | "emergencySituations";

export type CentreGuidelineOverrides = Partial<Record<CentreGuidelineId, string>>;

export type HospitalDocument = AuditedDocument & {
  name: string;
  description: string;
  email: string;
  phone: string;
  hospitalPhone1?: string;
  hospitalPhone2?: string | null;
  address: string;
  city: string;
  district?: string;
  state: string;
  imageUrl: string | null;
  imageUrls?: string[];
  ayursargaRating?: number | null;
  ayursargaReviewNote?: string | null;
  centreGuidelines?: CentreGuidelineOverrides;
  additionalCentreRules?: string;
  facilities?: string;
  legalPolicies?: string;
  locationUrl?: string | null;
  additionalBystandersAllowed?: boolean;
  maxAdditionalBystanders?: number;
  additionalBystanderCharge?: number;
  status: UserStatus;
  isPublic: boolean;
  commissionPercentage: number;
  contractStatus: "not_generated" | "generated" | "signed";
  contractGeneratedAt: Timestamp | null;
  contractGeneratedBy: string | null;
  contractSignedAt: Timestamp | null;
  contractSignedBy: string | null;
  contractUrl: string | null;
  contractSignedAt2?: Timestamp | null;
  contractSignedBy2?: string | null;
  contractUrl2?: string | null;
  activatedAt: Timestamp | null;
  activatedBy: string | null;
};

export type ServiceDocument = AuditedDocument & {
  hospitalId: string;
  name: string;
  description: string;
  price?: number;
  durationMinutes?: number | null;
  durationUnit?: "minutes" | "hours" | "days" | null;
  packageDurationDays?: number;
  procedures?: Record<string, number>;
  otherProcedures?: Array<{ name: string; days: number }>;
  otherProcedureName?: string | null;
  otherProcedureDays?: number | null;
  status: "active" | "inactive" | "archived";
};

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "reschedule_requested"
  | "rejected"
  | "cancelled"
  | "completed";

export type TreatmentStatus = "not_started" | "started" | "ongoing" | "completed";

export type BookingDocument = AuditedDocument & {
  consumerId: string;
  consumerName: string;
  consumerEmail: string;
  consumerPhone: string;
  consumerAddress: string | null;
  hospitalId: string;
  serviceId: string;
  preferredDate: Timestamp;
  preferredEndDate?: Timestamp | null;
  preferredTime: string;
  bystanderCount?: number;
  additionalBystanderCharge?: number;
  additionalBystanderTotal?: number;
  confirmedDate: Timestamp | null;
  confirmedTime: string | null;
  status: BookingStatus;
  treatmentStatus?: TreatmentStatus;
  servicePrice: number;
  commissionPercentage: number;
  estimatedCommission: number;
  consumerNotes: string | null;
  hospitalNotes: string | null;
  confirmedAt: Timestamp | null;
  completedAt: Timestamp | null;
  treatmentStartedAt?: Timestamp | null;
  treatmentCompletedAt?: Timestamp | null;
  bookingTermsAcceptedAt?: Timestamp | null;
  bookingTermsVersion?: string | null;
};

export type HospitalCapacityDocument = AuditedDocument & {
  hospitalId: string;
  totalRooms: number;
  occupiedRooms: number;
  status: "active" | "archived";
};

export type ConsultantDocument = AuditedDocument & {
  employeeId: string;
  employeeSequence: number;
  name: string;
  email: string;
  contactNo: string;
  whatsappNo: string;
  qualification: string;
  yearsExperience: number;
  lastWorkedCompany: string;
  address: string;
  emergencyContactNo: string;
  status: "active" | "inactive";
};

export type HospitalStaffDocument = AuditedDocument & {
  uid: string;
  hospitalId: string;
  name: string;
  email: string;
  status: RecordStatus;
};

export type DoctorDocument = AuditedDocument & {
  hospitalId: string;
  name: string;
  speciality: string;
  status: RecordStatus;
};

export type AvailabilityDocument = AuditedDocument & {
  hospitalId: string;
  doctorId: string | null;
  serviceId: string | null;
  startsAt: Timestamp;
  endsAt: Timestamp;
  status: RecordStatus;
};

export type PaymentDocument = AuditedDocument & {
  bookingId: string;
  consumerId: string;
  hospitalId: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded" | "archived";
};

export type NotificationDocument = AuditedDocument & {
  recipientId: string;
  title: string;
  message: string;
  readAt: Timestamp | null;
  status: "active" | "archived";
};

export type AuditAction =
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "status_change"
  | "contract_generated"
  | "contract_signed"
  | "hospital_activated";

export type AuditLogDocument = {
  action: AuditAction;
  module: string;
  recordId: string;
  actorId: string;
  actorRole: PortalRole;
  previousValues: Record<string, unknown> | null;
  updatedValues: Record<string, unknown>;
  timestamp: Timestamp;
  source: "web" | "server";
  device: {
    userAgent: string | null;
    platform: string | null;
    ipAddress: string | null;
  };
};

export type SystemSettingDocument = AuditedDocument & {
  key: string;
  value: unknown;
  status: "active" | "archived";
};
