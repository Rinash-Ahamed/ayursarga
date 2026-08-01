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
  slug: string;
  description: string;
  email: string;
  phone: string | null;
  address: string;
  district: string;
  state: string;
  status: UserStatus;
  isPublic: boolean;
};

export type HospitalStaffDocument = AuditedDocument & {
  userId: string;
  hospitalId: string;
  title: string;
  status: UserStatus;
};

export type DoctorDocument = AuditedDocument & {
  hospitalId: string;
  name: string;
  specialties: string[];
  status: UserStatus;
  isPublic: boolean;
};

export type ServiceDocument = AuditedDocument & {
  hospitalId: string;
  name: string;
  description: string;
  durationMinutes: number;
  status: UserStatus;
  isPublic: boolean;
};

export type AvailabilityDocument = AuditedDocument & {
  hospitalId: string;
  doctorId: string | null;
  serviceId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "held" | "booked" | "blocked";
};

export type BookingDocument = AuditedDocument & {
  consumerId: string;
  hospitalId: string;
  doctorId: string | null;
  serviceId: string;
  availabilityId: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes: string | null;
};

export type NotificationDocument = {
  userId: string;
  title: string;
  body: string;
  readAt: Timestamp | null;
  createdAt: Timestamp;
};

export type FirestoreCollectionMap = {
  users: UserDocument;
  hospitals: HospitalDocument;
  hospitalStaff: HospitalStaffDocument;
  doctors: DoctorDocument;
  services: ServiceDocument;
  availability: AvailabilityDocument;
  bookings: BookingDocument;
  notifications: NotificationDocument;
};
