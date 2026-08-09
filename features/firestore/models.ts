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
  role: PortalRole;
  status: UserStatus;
  hospitalId: string | null;
};

export type HospitalDocument = AuditedDocument & {
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  imageUrl: string | null;
  status: UserStatus;
  isPublic: boolean;
  commissionPercentage: number;
};

export type ServiceDocument = AuditedDocument & {
  hospitalId: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number | null;
  status: "active" | "inactive" | "archived";
};

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "reschedule_requested"
  | "rejected"
  | "cancelled"
  | "completed";

export type BookingDocument = AuditedDocument & {
  consumerId: string;
  hospitalId: string;
  serviceId: string;
  preferredDate: Timestamp;
  preferredTime: string;
  confirmedDate: Timestamp | null;
  confirmedTime: string | null;
  status: BookingStatus;
  servicePrice: number;
  commissionPercentage: number;
  estimatedCommission: number;
  consumerNotes: string | null;
  hospitalNotes: string | null;
  confirmedAt: Timestamp | null;
  completedAt: Timestamp | null;
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

export type AuditAction = "create" | "update" | "archive" | "restore" | "status_change";

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
