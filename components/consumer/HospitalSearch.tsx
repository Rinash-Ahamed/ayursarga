"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { HospitalDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listPublicHospitals } from "@/services/hospitals/publicHospitalService";
import { getHospitalRating, matchesRatingFilter, type RatingFilter } from "@/features/hospitals/ratings";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

export function HospitalSearch() {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listPublicHospitals({ pageSize: 20, cursor }), []);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<HospitalDocument>(
    loader,
    "We could not load the hospitals. Refresh the page and try again.",
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || `${item.name} ${item.city} ${item.state}`.toLowerCase().includes(term);
      return matchesSearch && matchesRatingFilter(item, ratingFilter);
    });
  }, [items, ratingFilter, search]);

  return <PortalShell role="consumer" title="Find Ayurvedic care" eyebrow="Hospital discovery">
    <PortalLoadGuard loading={isLoading} error={error} hasData={items.length > 0} fallbackHref="/" loadingMessage="Finding Ayurvedic hospitals…" />
    <div className="portal-card portal-discovery-filters">
      <label>Search the current page by hospital, city, or state
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hospitals" />
      </label>
      <label>Rating category
        <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value as RatingFilter)}>
          <option value="all">All hospitals</option>
          <option value="4_plus">4 stars and above</option>
          <option value="3_plus">3 stars and above</option>
          <option value="unrated">New, not yet rated</option>
        </select>
      </label>
    </div>
    <PortalFeedback error={items.length > 0 ? error : null} empty={!error && !isLoading && visible.length === 0
      ? "No hospitals match these filters. Adjust the search or rating category and try again."
      : undefined} />
    <div className="portal-grid">
      {visible.map((hospital) => {
        const rating = getHospitalRating(hospital);
        return <article className="portal-card" key={hospital.id}>
          <div className="portal-row-heading">
            <span className="portal-status">{hospital.city}, {hospital.state}</span>
            <span className="portal-rating-category">{rating.category}</span>
          </div>
          <h2 style={{ marginTop: 14 }}>{hospital.name}</h2>
          <p>{hospital.description}</p>
          <p className="portal-rating-summary" aria-label={rating.count ? `${rating.average.toFixed(1)} out of 5 from ${rating.count} ratings` : "Not yet rated"}>
            {rating.count ? <>{"★".repeat(Math.round(rating.average))}<span>{rating.average.toFixed(1)} ({rating.count})</span></> : <span>Awaiting its first verified rating</span>}
          </p>
          <div className="portal-actions"><Link className="portal-button" href={`/app/hospitals/${hospital.id}`}>View services</Link></div>
        </article>;
      })}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
