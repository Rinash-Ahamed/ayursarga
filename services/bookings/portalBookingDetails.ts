"use client";

import type { BookingDocument, HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import { packageTitle } from "@/features/hospitals/packages";
import { readDocumentsByIds, type QueryPage } from "@/services/firestore/firestoreService";

/** Admin/Hospital only. Consumers use their ownership-checked details endpoint. */
export async function withPortalBookingDetails<T extends QueryPage<BookingDocument>>(page: T, hospitalId?: string): Promise<T> {
  const missing = page.documents.filter((booking) => !booking.hospitalName || !booking.serviceName);
  if (!missing.length) return page;
  const [hospitals, services] = await Promise.all([
    readDocumentsByIds<HospitalDocument>(COLLECTIONS.hospitals, missing.filter((booking) => !booking.hospitalName).map((booking) => booking.hospitalId)),
    readDocumentsByIds<ServiceDocument>(COLLECTIONS.services, missing.filter((booking) => !booking.serviceName).map((booking) => booking.serviceId),
      hospitalId ? [{ field: "hospitalId", operator: "==", value: hospitalId }] : []),
  ]);
  const hospitalMap = new Map(hospitals.map((hospital) => [hospital.id, hospital]));
  const serviceMap = new Map(services.map((service) => [service.id, service]));
  return { ...page, documents: page.documents.map((booking) => {
    const hospital = hospitalMap.get(booking.hospitalId);
    const service = serviceMap.get(booking.serviceId);
    return { ...booking,
      hospitalName: booking.hospitalName || hospital?.name,
      hospitalLocation: booking.hospitalLocation || (hospital ? [...new Set([hospital.city, hospital.district, hospital.state].filter(Boolean))].join(", ") : undefined),
      serviceName: booking.serviceName || (service?.hospitalId === booking.hospitalId ? packageTitle(service) : undefined),
    };
  }) };
}
