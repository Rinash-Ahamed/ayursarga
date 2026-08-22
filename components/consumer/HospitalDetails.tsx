"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { listActiveHospitalServices } from "@/services/hospitals/serviceService";
import { formatCurrency } from "@/utils/currency";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { formatServiceDuration } from "@/utils/duration";
import { HospitalImageGallery } from "@/components/hospital/HospitalImageGallery";
import { getHospitalImageUrls } from "@/features/hospitals/images";

export function HospitalDetails({ hospitalId }: { hospitalId: string }) {
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [hospitalLoading, setHospitalLoading] = useState(true);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) =>
    listActiveHospitalServices(hospitalId, { pageSize: 20, cursor }), [hospitalId]);
  const { items: services, error: serviceError, isLoading, hasMore, loadMore } = usePaginatedList<ServiceDocument>(loader, "We could not load this hospital's services. Refresh the page and try again.");
  const error = hospitalError ?? serviceError;
  useEffect(() => { void getHospital(hospitalId).then((record) => {
    setHospital(record);
    if (!record) setHospitalError("This hospital is no longer available.");
  }).catch(() => setHospitalError("We could not load this hospital."))
    .finally(() => setHospitalLoading(false)); }, [hospitalId]);
  return <PortalShell role="consumer" title={hospital?.name ?? "Hospital details"} eyebrow="Ayursarga hospital">
    <PortalLoadGuard loading={hospitalLoading || (isLoading && !hospital)} error={hospitalError} hasData={Boolean(hospital)} fallbackHref="/app" loadingMessage="Loading hospital details…" />
    <PortalFeedback error={error} empty={!error && !hospital ? "Loading hospital details…" : undefined} />
    {hospital && <><article className="portal-card">
      <HospitalImageGallery imageUrls={getHospitalImageUrls(hospital)} hospitalName={hospital.name} />
      <p>{hospital.description}</p><div className="portal-card-meta"><span>{hospital.address}</span><span>{hospital.city}, {hospital.state}</span><span>{hospital.phone}</span></div>
    </article><h2 style={{ margin: "34px 0 18px", color: "var(--forest)", fontFamily: "var(--font-display)", fontWeight: 400 }}>Active services</h2>
    <div className="portal-grid">{services.map((service) => <article className="portal-card" key={service.id}>
      <h3>{service.name}</h3><p>{service.description}</p><div className="portal-card-meta"><span>{formatCurrency(service.price)}</span><span>{formatServiceDuration(service.durationMinutes, service.durationUnit)}</span></div>
      <div className="portal-actions"><Link className="portal-button" href={`/app/bookings/new?hospitalId=${hospitalId}&serviceId=${service.id}`}>Request appointment</Link></div>
    </article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} /></>}
  </PortalShell>;
}
