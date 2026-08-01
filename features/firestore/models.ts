import type { Timestamp } from "firebase/firestore";
import type { PortalRole, UserStatus } from "@/features/auth/contracts";

type AuditedDocument = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdBy: string;
};

export type ServiceDocument = AuditedDocument & {
  hospitalId: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number | null;
  status: "active" | "inactive";
};

export const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "reschedule_requested",
  "rejected",
  "cancelled",
  "completed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

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

export type FirestoreCollectionMap = {
  users: UserDocument;
  hospitals: HospitalDocument;
  services: ServiceDocument;
  bookings: BookingDocument;
};
