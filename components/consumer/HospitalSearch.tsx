"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { HospitalDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listPublicHospitals } from "@/services/hospitals/hospitalService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";

export function HospitalSearch() {
  const [search, setSearch] = useState("");
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listPublicHospitals({ pageSize: 20, cursor }), []);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<HospitalDocument>(loader, "Hospitals could not be loaded.");
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => `${item.name} ${item.city} ${item.state}`.toLowerCase().includes(term)) : items;
  }, [items, search]);
  return <PortalShell role="consumer" title="Find Ayurvedic care" eyebrow="Hospital discovery">
    <div className="portal-card" style={{ marginBottom: 22 }}>
      <label className="portal-form"><span className="full">Search the current page by hospital, city, or state
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hospitals" /></span></label>
    </div>
    <PortalFeedback error={error} empty={!error && !isLoading && visible.length === 0 ? "No active public hospitals are available yet." : undefined} />
    <div className="portal-grid">{visible.map((hospital) => <article className="portal-card" key={hospital.id}>
      <span className="portal-status">{hospital.city}, {hospital.state}</span>
      <h2 style={{ marginTop: 14 }}>{hospital.name}</h2><p>{hospital.description}</p>
      <div className="portal-actions"><Link className="portal-button" href={`/app/hospitals/${hospital.id}`}>View services</Link></div>
    </article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
