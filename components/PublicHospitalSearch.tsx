"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
  listPublicHospitals,
  listPublicHospitalsByServiceName,
} from "@/services/hospitals/publicHospitalService";
import type {
  DocumentRecord,
  QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { getHospitalImageUrls } from "@/features/hospitals/images";
import { addCentreSearchContext, formatBystanders, type CentreSearchContext } from "@/features/hospitals/searchContext";

type PublicHospitalSearchProps = {
  initialService?: string;
  initialContext: CentreSearchContext;
  initialSearch?: string;
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

export default function PublicHospitalSearch({ initialService = "", initialContext, initialSearch = "" }: PublicHospitalSearchProps) {
  const [search, setSearch] = useState(initialSearch);
  const [startDate, setStartDate] = useState(initialContext.startDate);
  const [bystanders, setBystanders] = useState(initialContext.bystanders);
  const [dateError, setDateError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
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
      const searchable = `${hospital.name} ${hospital.city} ${hospital.district ?? ""} ${hospital.state} ${hospital.address}`.toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [hospitals, search]);

  function openDatePicker(event: MouseEvent<HTMLLabelElement>) {
    const input = event.currentTarget.querySelector("input");
    if (!input || event.target === input || typeof input.showPicker !== "function") return;
    event.preventDefault();
    input.focus();
    try {
      input.showPicker();
    } catch {
      // The focused native date input remains usable when a browser blocks showPicker.
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startDate && startDate < today) {
      setDateError("Choose a preferred start date from today onwards.");
      return;
    }
    setDateError(null);
    setSearch((current) => current.trim());
  }

  return (
    <section id="search-centers" className="section public-center-search" tabIndex={-1}>
      <div className="section-inner">
        <div className="public-search-heading">
          <span className="eyebrow">Approved Ayurvedic centers</span>
          <h1 className="section-title">Search for care that feels right.</h1>
          <p>Explore active Ayursarga partner centers and their available treatments. Google sign-in is required only when you request an appointment.</p>
        </div>

        <form className="public-search-filters" role="search" aria-label="Search Ayurvedic centers" onSubmit={submitSearch}>
          <label className="public-search-field public-search-destination">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20v-9l8-6 8 6v9M8 20v-6h8v6M3 20h18" /></svg>
            <span><small>Centre or location</small><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search as you type" /></span>
          </label>
          <div className="public-search-field public-search-dates">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
            <span className="public-date-inputs">
              <label className="public-date-control" onClick={openDatePicker}><span>Start date / expected delivery date</span><input aria-label="Start date or expected delivery date" type="date" min={today} value={startDate} onChange={(event) => { setStartDate(event.target.value); setDateError(null); }} /></label>
            </span>
          </div>
          <label className="public-search-field public-search-bystanders">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
            <span><small>Accompanying support</small><select value={bystanders} onChange={(event) => setBystanders(Number(event.target.value))}>{[0, 1, 2, 3, 4].map((count) => <option value={count} key={count}>{formatBystanders(count)}</option>)}</select></span>
          </label>
          <button type="submit" className="public-search-submit"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg><span>Search</span></button>
        </form>
        {dateError && <p className="public-search-date-error" role="alert">{dateError}</p>}

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
            ) : "No centers match your search. Try another centre name or location."}
          </div>
        )}

        <div className="public-center-grid">
          {visibleHospitals.map((hospital, hospitalIndex) => {
            const detailParams = addCentreSearchContext(new URLSearchParams(), { startDate, endDate: "", bystanders });
            if (initialService) detailParams.set("service", initialService);
            if (search) detailParams.set("q", search);
            const detailHref = `/centers/${encodeURIComponent(hospital.id)}?${detailParams.toString()}`;
            return (
              <article className="public-center-card" key={hospital.id}>
                <Link className="public-center-card-link" href={detailHref} aria-label={`View details for ${hospital.name}`} />
                <PublicHospitalImages hospital={hospital} priority={hospitalIndex === 0} />
                <div className="public-center-card-body">
                  <div className="public-center-card-topline">
                    <span>{hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</span>
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
                  <span className="public-center-toggle" aria-hidden="true">View centre details <span>→</span></span>
                </div>
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
