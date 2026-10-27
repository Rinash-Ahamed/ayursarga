"use client";

import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPage } from "@/services/firestore/firestoreService";
import { shareInFlightRequest } from "@/utils/inFlightRequests";

export type PublicPageCursor = string;
// Public HTTP dates need no operational Firestore SDK in the discovery bundle.
export type PublicHospitalDocument = Omit<HospitalDocument, "blockedDateRanges"> & {
  blockedDateRanges?: Array<{ startDate: Date; endDate: Date; availabilityId: string }>;
};
type PublicPageOptions = { pageSize?: number; cursor?: PublicPageCursor | null };
type SerializedRange = { startDate: string; endDate: string };
type SerializedHospital = Omit<DocumentRecord<PublicHospitalDocument>, "blockedDateRanges"> & { blockedDateRanges?: SerializedRange[] };
type ApiPage<T> = { documents?: T[]; cursor?: string | null; hasMore?: boolean; error?: string };

function publicRequest<T>(url: string, signal?: AbortSignal) {
  // Only public GETs overlap here. Keep caller-abortable requests independent,
  // and rely on the endpoint's HTTP cache policy rather than retaining stale data.
  return shareInFlightRequest<T>(signal ? null : `public-get:${url}`, async () => {
    const response = await fetch(url, { signal });
    const body = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(body.error || "The requested information is temporarily unavailable.");
    return body;
  });
}

function publicPageUrl(path: string, options: PublicPageOptions, serviceName = "") {
  const params = new URLSearchParams({ pageSize: String(options.pageSize ?? 12) });
  if (options.cursor) params.set("cursor", options.cursor);
  if (serviceName) params.set("service", serviceName);
  return `${path}?${params.toString()}`;
}

function restoreHospital(document: SerializedHospital): DocumentRecord<PublicHospitalDocument> {
  const ranges = Array.isArray(document.blockedDateRanges)
    ? document.blockedDateRanges.map((range) => ({
      startDate: new Date(range.startDate),
      endDate: new Date(range.endDate),
      availabilityId: "",
    }))
    : [];
  return { ...document, blockedDateRanges: ranges };
}

async function hospitalPage(url: string): Promise<QueryPage<PublicHospitalDocument, PublicPageCursor>> {
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

export function searchPublicHospitals(search: string, options: PublicPageOptions = {}) {
  const params = new URLSearchParams({
    pageSize: String(options.pageSize ?? 8),
    q: search.trim().slice(0, 80),
  });
  return hospitalPage(`/api/public/hospitals?${params.toString()}`);
}

export function listPublicHospitalsByServiceName(serviceName: string, options: PublicPageOptions = {}) {
  return hospitalPage(publicPageUrl("/api/public/hospitals", options, serviceName.trim().slice(0, 100)));
}

export async function getPublicHospital(hospitalId: string, signal?: AbortSignal) {
  const body = await publicRequest<{ hospital?: SerializedHospital }>(
    `/api/public/hospitals/${encodeURIComponent(hospitalId)}`,
    signal,
  );
  return body.hospital ? restoreHospital(body.hospital) : null;
}

export async function listPublicHospitalServices(hospitalId: string, options: PublicPageOptions & { signal?: AbortSignal } = {}): Promise<QueryPage<ServiceDocument, PublicPageCursor>> {
  const body = await publicRequest<ApiPage<DocumentRecord<ServiceDocument>>>(publicPageUrl(
    `/api/public/hospitals/${encodeURIComponent(hospitalId)}/services`,
    options,
  ), options.signal);
  return {
    documents: body.documents ?? [],
    cursor: body.cursor ?? null,
    hasMore: Boolean(body.hasMore),
  };
}

export async function getPublicHospitalService(hospitalId: string, serviceId: string, signal?: AbortSignal) {
  let cursor: PublicPageCursor | null = null;
  do {
    const page = await listPublicHospitalServices(hospitalId, { pageSize: 24, cursor, signal });
    const selected = page.documents.find((service) => service.id === serviceId);
    if (selected) return selected;
    if (!page.hasMore || !page.cursor || page.cursor === cursor) return null;
    cursor = page.cursor;
  } while (!signal?.aborted);
  return null;
}
