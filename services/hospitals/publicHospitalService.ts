"use client";

import { Timestamp } from "firebase/firestore";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPage } from "@/services/firestore/firestoreService";

export type PublicPageCursor = string;
type PublicPageOptions = { pageSize?: number; cursor?: PublicPageCursor | null };
type SerializedRange = { startDate: string; endDate: string };
type SerializedHospital = Omit<DocumentRecord<HospitalDocument>, "blockedDateRanges"> & { blockedDateRanges?: SerializedRange[] };
type ApiPage<T> = { documents?: T[]; cursor?: string | null; hasMore?: boolean; error?: string };

async function publicRequest<T>(url: string) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The requested information is temporarily unavailable.");
  return body;
}

function publicPageUrl(path: string, options: PublicPageOptions, serviceName = "") {
  const params = new URLSearchParams({ pageSize: String(options.pageSize ?? 12) });
  if (options.cursor) params.set("cursor", options.cursor);
  if (serviceName) params.set("service", serviceName);
  return `${path}?${params.toString()}`;
}

function restoreHospital(document: SerializedHospital) {
  const ranges = Array.isArray(document.blockedDateRanges)
    ? document.blockedDateRanges.map((range) => ({
      startDate: Timestamp.fromDate(new Date(range.startDate)),
      endDate: Timestamp.fromDate(new Date(range.endDate)),
      availabilityId: "",
    }))
    : [];
  return { ...document, blockedDateRanges: ranges } as DocumentRecord<HospitalDocument>;
}

async function hospitalPage(url: string): Promise<QueryPage<HospitalDocument, PublicPageCursor>> {
  const body = await publicRequest<ApiPage<SerializedHospital>>(url);
  return {
    documents: (body.documents ?? []).map(restoreHospital),
    cursor: body.cursor ?? null,
    hasMore: Boolean(body.hasMore),
  };
}

export function listPublicHospitals(options: PublicPageOptions = {}) {
  return hospitalPage(publicPageUrl("/api/public/hospitals", options));
}

export function listPublicHospitalsByServiceName(serviceName: string, options: PublicPageOptions = {}) {
  return hospitalPage(publicPageUrl("/api/public/hospitals", options, serviceName.trim().slice(0, 100)));
}

export async function getPublicHospital(hospitalId: string) {
  const body = await publicRequest<{ hospital?: SerializedHospital }>(
    `/api/public/hospitals/${encodeURIComponent(hospitalId)}`,
  );
  return body.hospital ? restoreHospital(body.hospital) : null;
}

export async function listPublicHospitalServices(hospitalId: string, options: PublicPageOptions = {}): Promise<QueryPage<ServiceDocument, PublicPageCursor>> {
  const body = await publicRequest<ApiPage<DocumentRecord<ServiceDocument>>>(publicPageUrl(
    `/api/public/hospitals/${encodeURIComponent(hospitalId)}/services`,
    options,
  ));
  return {
    documents: body.documents ?? [],
    cursor: body.cursor ?? null,
    hasMore: Boolean(body.hasMore),
  };
}

export async function getPublicHospitalService(hospitalId: string, serviceId: string) {
  const body = await publicRequest<{ service?: DocumentRecord<ServiceDocument> }>(
    `/api/public/hospitals/${encodeURIComponent(hospitalId)}/services/${encodeURIComponent(serviceId)}`,
  );
  return body.service ?? null;
}
