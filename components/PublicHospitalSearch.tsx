"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
  listPublicHospitals,
  listPublicHospitalServices,
} from "@/services/hospitals/publicHospitalService";
import type {
  DocumentRecord,
  QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { formatCurrency } from "@/utils/currency";
import { formatServiceDuration } from "@/utils/duration";

type ServicePageState = {
  items: DocumentRecord<ServiceDocument>[];
  cursor: QueryPageOptions["cursor"];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
};

export default function PublicHospitalSearch() {
  const [search, setSearch] = useState("");
  const [expandedHospitalId, setExpandedHospitalId] = useState<string | null>(null);
  const [servicePages, setServicePages] = useState<Record<string, ServicePageState>>({});
  const hospitalLoader = useCallback(
    (cursor: QueryPageOptions["cursor"]) => listPublicHospitals({ pageSize: 12, cursor }),
    [],
  );
  const { items: hospitals, error, isLoading, hasMore, loadMore } = usePaginatedList<HospitalDocument>(
    hospitalLoader,
    "We could not load Ayurvedic centers right now. Please try again.",
  );

  const visibleHospitals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return hospitals.filter((hospital) => {
      const searchable = `${hospital.name} ${hospital.city} ${hospital.state}`.toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [hospitals, search]);

  async function loadServices(hospitalId: string, append: boolean) {
    const currentPage = servicePages[hospitalId];
    if (currentPage?.isLoading) return;
    const cursor = append ? currentPage?.cursor ?? null : null;

    setServicePages((current) => ({
      ...current,
      [hospitalId]: {
        items: append ? current[hospitalId]?.items ?? [] : [],
        cursor: current[hospitalId]?.cursor ?? null,
        hasMore: current[hospitalId]?.hasMore ?? false,
        isLoading: true,
        error: null,
      },
    }));

    try {
      const page = await listPublicHospitalServices(hospitalId, { pageSize: 8, cursor });
      setServicePages((current) => {
        const existing = append ? current[hospitalId]?.items ?? [] : [];
        return {
          ...current,
          [hospitalId]: {
            items: [...existing, ...page.documents.filter((service) =>
              !existing.some((item) => item.id === service.id))],
            cursor: page.cursor,
            hasMore: page.hasMore,
            isLoading: false,
            error: null,
          },
        };
      });
    } catch {
      setServicePages((current) => ({
        ...current,
        [hospitalId]: {
          items: current[hospitalId]?.items ?? [],
          cursor: current[hospitalId]?.cursor ?? null,
          hasMore: current[hospitalId]?.hasMore ?? false,
          isLoading: false,
          error: "We could not load this center's services. Please try again.",
        },
      }));
    }
  }

  function toggleServices(hospitalId: string) {
    const opening = expandedHospitalId !== hospitalId;
    setExpandedHospitalId(opening ? hospitalId : null);
    if (opening && !servicePages[hospitalId]) void loadServices(hospitalId, false);
  }

  return (
    <section id="search-centers" className="section public-center-search" tabIndex={-1}>
      <div className="section-inner">
        <div className="public-search-heading">
          <span className="eyebrow">Approved Ayurvedic centers</span>
          <h2 className="section-title">Search for care that feels right.</h2>
          <p>Explore active Ayursarga partner centers and their available treatments. Google sign-in is required only when you request an appointment.</p>
        </div>

        <div className="public-search-filters" role="search" aria-label="Search Ayurvedic centers">
          <label>
            <span>Center, city or state</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Ayurvedic centers"
            />
          </label>
        </div>

        {isLoading && hospitals.length === 0 && <div className="public-search-status" role="status">Finding approved Ayurvedic centers...</div>}
        {error && <div className="public-search-status error" role="alert">{error}</div>}
        {!isLoading && !error && visibleHospitals.length === 0 && (
          <div className="public-search-status">No centers match your search. Try another name, city or state.</div>
        )}

        <div className="public-center-grid">
          {visibleHospitals.map((hospital) => {
            const isExpanded = expandedHospitalId === hospital.id;
            const servicePage = servicePages[hospital.id];
            return (
              <article className="public-center-card" key={hospital.id}>
                <div className="public-center-card-topline">
                  <span>{hospital.city}, {hospital.state}</span>
                </div>
                <h3>{hospital.name}</h3>
                {hospital.description && <p>{hospital.description}</p>}
                <button
                  type="button"
                  className="public-center-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => toggleServices(hospital.id)}
                >
                  {isExpanded ? "Hide treatments" : "View treatments"}
                </button>

                {isExpanded && (
                  <div className="public-service-list">
                    {servicePage?.isLoading && servicePage.items.length === 0 && <p role="status">Loading treatments...</p>}
                    {servicePage?.error && (
                      <div className="public-service-error" role="alert">
                        <span>{servicePage.error}</span>
                        <button type="button" onClick={() => void loadServices(hospital.id, false)}>Try again</button>
                      </div>
                    )}
                    {servicePage && !servicePage.isLoading && !servicePage.error && servicePage.items.length === 0 && (
                      <p>No active treatments are listed for this center yet.</p>
                    )}
                    {servicePage?.items.map((service) => (
                      <article className="public-service-row" key={service.id}>
                        <div>
                          <h4>{service.name}</h4>
                          {service.description && <p>{service.description}</p>}
                          <span>{formatCurrency(service.price)} · {formatServiceDuration(service.durationMinutes, service.durationUnit)}</span>
                        </div>
                        <Link href={`/app/bookings/new?hospitalId=${hospital.id}&serviceId=${service.id}`}>
                          Request appointment
                        </Link>
                      </article>
                    ))}
                    {servicePage?.hasMore && (
                      <button
                        type="button"
                        className="public-load-more"
                        disabled={servicePage.isLoading}
                        onClick={() => void loadServices(hospital.id, true)}
                      >
                        {servicePage.isLoading ? "Loading..." : "Show more treatments"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {hasMore && (
          <button type="button" className="public-load-more centers" disabled={isLoading} onClick={() => void loadMore()}>
            {isLoading ? "Loading..." : "Show more centers"}
          </button>
        )}
      </div>
    </section>
  );
}
