"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
  listPublicHospitals,
  listPublicHospitalsByServiceName,
  listPublicHospitalServices,
} from "@/services/hospitals/publicHospitalService";
import type {
  DocumentRecord,
  QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { formatCurrency } from "@/utils/currency";
import { formatServiceDuration } from "@/utils/duration";
import { getHospitalImageUrls } from "@/features/hospitals/images";

type ServicePageState = {
  items: DocumentRecord<ServiceDocument>[];
  cursor: QueryPageOptions["cursor"];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
};

type PublicHospitalSearchProps = {
  initialService?: string;
};

function PublicHospitalImages({ hospital, priority = false }: { hospital: DocumentRecord<HospitalDocument>; priority?: boolean }) {
  const [activeImage, setActiveImage] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"previous" | "next">("next");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const navigationRequest = useRef(0);
  const images = getHospitalImageUrls(hospital).filter((url) => !failedImages.includes(url));
  const displayedIndex = Math.min(activeImage, Math.max(images.length - 1, 0));
  const imageUrl = images[displayedIndex];

  function showImage(index: number, direction: "previous" | "next") {
    const targetUrl = images[index];
    if (!targetUrl || index === displayedIndex) return;
    const requestId = ++navigationRequest.current;
    const preload = new window.Image();
    preload.src = targetUrl;

    const reveal = () => {
      if (requestId !== navigationRequest.current) return;
      setSlideDirection(direction);
      setLoadedImageUrl(null);
      setActiveImage(index);
    };
    const reject = () => {
      if (requestId !== navigationRequest.current) return;
      setFailedImages((current) => current.includes(targetUrl) ? current : [...current, targetUrl]);
      setActiveImage(0);
    };

    if (preload.complete) {
      if (preload.naturalWidth > 0) reveal();
      else reject();
      return;
    }
    preload.onload = reveal;
    preload.onerror = reject;
  }

  if (!imageUrl) return <div className="public-center-card-image placeholder" aria-hidden="true">
    <span>Ayursarga</span>
  </div>;

  return <div className="public-center-card-image">
    {/* Hospital images use Admin-approved external HTTPS or Google Drive sources. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      key={imageUrl}
      className={loadedImageUrl === imageUrl ? "is-loaded" : ""}
      src={imageUrl}
      alt={`${hospital.name} Ayurvedic center`}
      data-direction={slideDirection}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoadedImageUrl(imageUrl)}
      onError={() => {
        setFailedImages((current) => [...current, imageUrl]);
        setActiveImage(0);
      }}
    />
    {images.length > 1 && <div className="public-center-image-arrows">
      <button
        type="button"
        aria-label="Show previous hospital image"
        onClick={() => showImage((displayedIndex - 1 + images.length) % images.length, "previous")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        aria-label="Show next hospital image"
        onClick={() => showImage((displayedIndex + 1) % images.length, "next")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </button>
    </div>}
    {images.length > 1 && <div className="public-center-image-nav" aria-label={`${hospital.name} image gallery`}>
      {images.map((url, index) => <button
        type="button"
        key={url}
        className={index === displayedIndex ? "active" : ""}
        aria-label={`Show image ${index + 1} of ${images.length}`}
        aria-pressed={index === displayedIndex}
        onClick={() => showImage(index, index < displayedIndex ? "previous" : "next")}
      />)}
      <span>{displayedIndex + 1} / {images.length}</span>
    </div>}
  </div>;
}

export default function PublicHospitalSearch({ initialService = "" }: PublicHospitalSearchProps) {
  const [search, setSearch] = useState("");
  const [expandedHospitalId, setExpandedHospitalId] = useState<string | null>(null);
  const [servicePages, setServicePages] = useState<Record<string, ServicePageState>>({});
  const hospitalLoader = useCallback(
    (cursor: QueryPageOptions["cursor"]) => initialService
      ? listPublicHospitalsByServiceName(initialService, { pageSize: 12, cursor })
      : listPublicHospitals({ pageSize: 12, cursor }),
    [initialService],
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
          <span className="eyebrow">{initialService ? `Centers offering ${initialService}` : "Approved Ayurvedic centers"}</span>
          <h2 className="section-title">{initialService ? `Find ${initialService} care.` : "Search for care that feels right."}</h2>
          <p>{initialService
            ? `Explore active Ayursarga partner centers that currently list ${initialService}. Google sign-in is required only when you request an appointment.`
            : "Explore active Ayursarga partner centers and their available treatments. Google sign-in is required only when you request an appointment."}</p>
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
          <div className="public-search-status">
            {initialService && !search.trim() ? (
              <>
                <strong>No active center currently lists {initialService}.</strong>
                <span>You can explore all approved centers or ask Ayursarga for personal guidance.</span>
                <Link href="/centers">Explore all centers</Link>
              </>
            ) : "No centers match your search. Try another name, city or state."}
          </div>
        )}

        <div className="public-center-grid">
          {visibleHospitals.map((hospital, hospitalIndex) => {
            const isExpanded = expandedHospitalId === hospital.id;
            const servicePage = servicePages[hospital.id];
            return (
              <article className="public-center-card" key={hospital.id}>
                <PublicHospitalImages hospital={hospital} priority={hospitalIndex === 0} />
                <div className="public-center-card-body">
                  <div className="public-center-card-topline">
                    <span>{hospital.city}, {hospital.state}</span>
                  </div>
                  <h3>{hospital.name}</h3>
                  {hospital.ayursargaRating && <div className="public-center-assessment" aria-label={`Ayursarga assessment ${hospital.ayursargaRating} out of 5`}>
                    <span className="public-center-stars" aria-hidden="true">
                      <span>★★★★★</span>
                      <span style={{ width: `${hospital.ayursargaRating / 5 * 100}%` }}>★★★★★</span>
                    </span>
                    <strong>{hospital.ayursargaRating.toFixed(1)}</strong>
                  </div>}
                  {hospital.description && <p>{hospital.description}</p>}
                  {hospital.ayursargaReviewNote && <div className="public-center-review">
                    <p>{hospital.ayursargaReviewNote}</p>
                  </div>}
                  <button
                    type="button"
                    className="public-center-toggle"
                    aria-expanded={isExpanded}
                    onClick={() => toggleServices(hospital.id)}
                  >
                    {isExpanded ? "Hide treatments" : "View treatments"}
                  </button>
                </div>

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
