"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { HospitalDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listPublicHospitals } from "@/services/hospitals/publicHospitalService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

export function HospitalSearch() {
  const [search, setSearch] = useState("");
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listPublicHospitals({ pageSize: 20, cursor }), []);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<HospitalDocument>(
    loader,
    "We could not load the hospitals. Refresh the page and try again.",
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => !term || `${item.name} ${item.city} ${item.state}`.toLowerCase().includes(term));
  }, [items, search]);

  return <PortalShell role="consumer" title="Find Ayurvedic care" eyebrow="Hospital discovery">
    <PortalLoadGuard loading={isLoading} error={error} hasData={items.length > 0} fallbackHref="/" loadingMessage="Finding Ayurvedic hospitals…" />
    <div className="portal-card portal-discovery-filters">
      <label>Search the current page by hospital, city, or state
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hospitals" />
      </label>
    </div>
    <PortalFeedback error={items.length > 0 ? error : null} empty={!error && !isLoading && visible.length === 0
      ? "No hospitals match this search. Try another hospital, city, or state."
      : undefined} />
    <div className="portal-grid">
      {visible.map((hospital) => <article className="portal-card" key={hospital.id}>
          <div className="portal-row-heading">
            <span className="portal-status">{hospital.city}, {hospital.state}</span>
          </div>
          <h2 style={{ marginTop: 14 }}>{hospital.name}</h2>
          <p>{hospital.description}</p>
          <div className="portal-actions"><Link className="portal-button" href={`/app/hospitals/${hospital.id}`}>View services</Link></div>
        </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
