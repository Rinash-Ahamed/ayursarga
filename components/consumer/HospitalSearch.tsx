"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { listPublicHospitals } from "@/services/hospitals/hospitalService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function HospitalSearch() {
  const [items, setItems] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listPublicHospitals({ pageSize: 20 })
    .then((page) => setItems(page.documents)).catch(() => setError("Hospitals could not be loaded.")); }, []);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => `${item.name} ${item.city} ${item.state}`.toLowerCase().includes(term)) : items;
  }, [items, search]);
  return <PortalShell role="consumer" title="Find Ayurvedic care" eyebrow="Hospital discovery">
    <div className="portal-card" style={{ marginBottom: 22 }}>
      <label className="portal-form"><span className="full">Search the current page by hospital, city, or state
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hospitals" /></span></label>
    </div>
    <PortalFeedback error={error} empty={!error && visible.length === 0 ? "No active public hospitals are available yet." : undefined} />
    <div className="portal-grid">{visible.map((hospital) => <article className="portal-card" key={hospital.id}>
      <span className="portal-status">{hospital.city}, {hospital.state}</span>
      <h2 style={{ marginTop: 14 }}>{hospital.name}</h2><p>{hospital.description}</p>
      <div className="portal-actions"><Link className="portal-button" href={`/app/hospitals/${hospital.id}`}>View services</Link></div>
    </article>)}</div>
  </PortalShell>;
}
