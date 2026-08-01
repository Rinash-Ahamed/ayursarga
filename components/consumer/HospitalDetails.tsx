"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { listActiveHospitalServices } from "@/services/hospitals/serviceService";
import { formatCurrency } from "@/utils/currency";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function HospitalDetails({ hospitalId }: { hospitalId: string }) {
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [services, setServices] = useState<DocumentRecord<ServiceDocument>[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void Promise.all([getHospital(hospitalId), listActiveHospitalServices(hospitalId, { pageSize: 20 })])
    .then(([item, page]) => { setHospital(item); setServices(page.documents); })
    .catch(() => setError("Hospital details could not be loaded.")); }, [hospitalId]);
  return <PortalShell role="consumer" title={hospital?.name ?? "Hospital details"} eyebrow="Ayursarga hospital">
    <PortalFeedback error={error} empty={!error && !hospital ? "Loading hospital details…" : undefined} />
    {hospital && <><article className="portal-card">
      <p>{hospital.description}</p><div className="portal-card-meta"><span>{hospital.address}</span><span>{hospital.city}, {hospital.state}</span><span>{hospital.phone}</span></div>
    </article><h2 style={{ margin: "34px 0 18px", color: "var(--forest)", fontFamily: "var(--font-display)", fontWeight: 400 }}>Active services</h2>
    <div className="portal-grid">{services.map((service) => <article className="portal-card" key={service.id}>
      <h3>{service.name}</h3><p>{service.description}</p><div className="portal-card-meta"><span>{formatCurrency(service.price)}</span><span>{service.durationMinutes ? `${service.durationMinutes} minutes` : "Duration on request"}</span></div>
      <div className="portal-actions"><Link className="portal-button" href={`/app/bookings/new?hospitalId=${hospitalId}&serviceId=${service.id}`}>Request appointment</Link></div>
    </article>)}</div></>}
  </PortalShell>;
}
