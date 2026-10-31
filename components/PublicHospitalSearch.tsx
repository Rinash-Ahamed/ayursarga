"use client";

import Link from "next/link";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DateInput } from "@/components/forms/DateInput";
import { toDateInputValue } from "@/utils/date";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
  listPublicHospitals,
  listPublicHospitalsByServiceName,
  type PublicPageCursor,
  type PublicHospitalDocument,
} from "@/services/hospitals/publicHospitalService";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospitalImageUrls, hospitalImageSrcSet } from "@/features/hospitals/images";
import { useHospitalImageGallery } from "@/hooks/useHospitalImageGallery";
import { addCentreSearchContext, type CentreSearchContext } from "@/features/hospitals/searchContext";
import { isHospitalSoldOut } from "@/features/hospitals/availability";
import { PublicCentreComparison } from "@/components/PublicCentreComparison";

type PublicHospitalSearchProps = {
  initialService?: string;
  initialContext: CentreSearchContext;
  initialSearch?: string;
};

const SearchCentreComparison = memo(PublicCentreComparison);

const PublicHospitalImages = memo(function PublicHospitalImages({ hospital, priority = false }: { hospital: DocumentRecord<PublicHospitalDocument>; priority?: boolean }) {
  const sizes = "(max-width: 600px) calc((100vw - 86px) / 2), (max-width: 1100px) calc((100vw - 106px) / 2), 318px";
  const galleryRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [highPriority, setHighPriority] = useState(false);
  const [originalOnly, setOriginalOnly] = useState<string[]>([]);
  // Search prioritises covers, not the next photo in every visible gallery.
  // Gallery navigation still decodes a requested photo before replacing the cover.
  const { images, displayedIndex, imageUrl, direction, loadedImageUrl, markLoaded, failImage, showImage } = useHospitalImageGallery(getHospitalImageUrls(hospital), sizes, false);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    if (typeof IntersectionObserver === "undefined") {
      // Older browsers still load the requested photo; never leave an empty frame.
      const frame = window.requestAnimationFrame(() => setNearViewport(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHighPriority(priority && entry.boundingClientRect.top < window.innerHeight);
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "320px" });
    observer.observe(gallery);
    return () => observer.disconnect();
  }, [priority]);

  if (!imageUrl) return <div className="public-center-card-image placeholder" aria-hidden="true">
    <span>Ayursarga</span>
  </div>;

  return <div className="public-center-card-image" ref={galleryRef} aria-busy={nearViewport && loadedImageUrl !== imageUrl}>
    {loadedImageUrl !== imageUrl && <span className="public-center-image-skeleton" aria-hidden="true" />}
    {/* Uploaded photos provide responsive sources; existing external links remain supported. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {nearViewport && <img
      key={`${imageUrl}-${originalOnly.includes(imageUrl)}`}
      ref={(image) => { if (image?.complete && image.naturalWidth > 0) markLoaded(imageUrl); }}
      className={loadedImageUrl === imageUrl ? "is-loaded" : ""}
      src={imageUrl}
      srcSet={originalOnly.includes(imageUrl) ? undefined : hospitalImageSrcSet(imageUrl)}
      sizes={sizes}
      width={1200}
      height={900}
      alt={`${hospital.name} Ayurvedic center`}
      data-direction={direction}
      // IntersectionObserver already defers off-screen images. A second native
      // lazy-loading gate can postpone the request again after scrolling.
      loading="eager"
      fetchPriority={highPriority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => markLoaded(imageUrl)}
      onError={(event) => {
        // A missing responsive derivative must not discard a valid original.
        if (!originalOnly.includes(imageUrl) && event.currentTarget.currentSrc !== imageUrl && hospitalImageSrcSet(imageUrl)) {
          setOriginalOnly((current) => [...current, imageUrl]);
        } else failImage(imageUrl);
      }}
    />}
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
      <div className="public-center-image-dots" style={{ gridTemplateColumns: `repeat(${Math.min(images.length, 5)}, 24px)` }}>
        {images.map((url, index) => <button
          type="button"
          key={url}
          className={index === displayedIndex ? "active" : ""}
          aria-label={`Show image ${index + 1} of ${images.length}`}
          aria-pressed={index === displayedIndex}
          onClick={() => showImage(index, index < displayedIndex ? "previous" : "next")}
        />)}
      </div>
      <span>{displayedIndex + 1} / {images.length}</span>
    </div>}
  </div>;
});

const HospitalResultCard = memo(function HospitalResultCard({ hospital, detailQuery, priority, soldOut }: {
  hospital: DocumentRecord<PublicHospitalDocument>; detailQuery: string; priority: boolean; soldOut: boolean;
}) {
  return <article className="public-center-card">
    <PublicHospitalImages hospital={hospital} priority={priority} />
    <div className="public-center-card-body">
      <div className="public-center-card-topline"><span>{hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</span></div>
      <h3>{hospital.name}</h3>
      {soldOut && <span className="public-sold-out-badge">Sold Out</span>}
      {hospital.ayursargaRating && <div className="public-center-assessment" aria-label={`Ayursarga assessment ${hospital.ayursargaRating} out of 5`}>
        <span className="public-center-stars" aria-hidden="true"><span>★★★★★</span><span style={{ width: `${hospital.ayursargaRating / 5 * 100}%` }}>★★★★★</span></span>
        <strong>{hospital.ayursargaRating.toFixed(1)}</strong>
      </div>}
      {hospital.ayursargaReviewNote && <div className="public-center-review"><p>{hospital.ayursargaReviewNote}</p></div>}
      <Link className="public-center-toggle" href={`/centers/${encodeURIComponent(hospital.id)}?${detailQuery}`} prefetch={false} aria-label={`View details for ${hospital.name}`}>View centre details <span aria-hidden="true">→</span></Link>
    </div>
  </article>;
});

export default function PublicHospitalSearch({ initialService = "", initialContext, initialSearch = "" }: PublicHospitalSearchProps) {
  const [search, setSearch] = useState(initialSearch);
  // Input paints first; filtering and result links follow without a debounce timer.
  const resultSearch = useDeferredValue(search);
  const [startDate, setStartDate] = useState(initialContext.startDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const today = toDateInputValue();
  const hospitalLoader = useCallback(
    (cursor: PublicPageCursor | null) => initialService
      ? listPublicHospitalsByServiceName(initialService, { pageSize: 12, cursor })
      : listPublicHospitals({ pageSize: 12, cursor }),
    [initialService],
  );
  const { items: hospitals, error, isLoading, hasMore, loadMore } = usePaginatedList<PublicHospitalDocument, PublicPageCursor>(
    hospitalLoader,
    "We could not load Ayurvedic centers right now. Please try again.",
  );

  const visibleHospitals = useMemo(() => {
    const term = resultSearch.trim().toLowerCase();
    return hospitals.filter((hospital) => {
      const searchable = `${hospital.name} ${hospital.city} ${hospital.district ?? ""} ${hospital.state} ${hospital.address}`.toLowerCase();
      const matchesSearch = !term || searchable.includes(term);
      return matchesSearch;
    });
  }, [hospitals, resultSearch]);

  const detailQuery = useMemo(() => {
    const params = addCentreSearchContext(new URLSearchParams(), { ...initialContext, startDate, endDate: "" });
    if (initialService) params.set("service", initialService);
    if (resultSearch) params.set("q", resultSearch);
    return params.toString();
  }, [initialContext, initialService, resultSearch, startDate]);

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
          <p>Explore active Ayursarga partner centers and their available treatments. Google sign-in is required only when you book an appointment.</p>
        </div>

        <form className="public-search-filters" role="search" aria-label="Search Ayurvedic centers" onSubmit={submitSearch}>
          <label className="public-search-field public-search-destination">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20v-9l8-6 8 6v9M8 20v-6h8v6M3 20h18" /></svg>
            <span><small>Centre or location</small><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search as you type" /></span>
          </label>
          <div className="public-search-field public-search-dates">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
            <span className="public-date-inputs">
              <label className="public-date-control"><span>Start date / expected delivery date</span><DateInput aria-label="Start date or expected delivery date" aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "centre-date-error" : undefined} min={today} value={startDate} onChange={(event) => { setStartDate(event.target.value); setDateError(null); }} /></label>
            </span>
          </div>
          <button type="submit" className="public-search-submit"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg><span>Search</span></button>
        </form>
        {dateError && <p id="centre-date-error" className="public-search-date-error" role="alert">{dateError}</p>}

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

        <SearchCentreComparison detailQuery={(() => {
          const params = addCentreSearchContext(new URLSearchParams(), { ...initialContext, startDate, endDate: "" });
          if (initialService) params.set("service", initialService);
          return params.toString();
        })()} />

        <div className="public-center-grid" aria-busy={isLoading}>
          {isLoading && hospitals.length === 0 && <>
            <p className="public-search-loading" role="status">Finding approved Ayurvedic centers...</p>
            {Array.from({ length: 12 }, (_, index) => <article className="public-center-card public-center-skeleton" key={`loading-${index}`} aria-hidden="true">
              <div className="public-center-card-image" />
              <div className="public-center-card-body"><span /><span /><span /></div>
            </article>)}
          </>}
          {visibleHospitals.map((hospital, hospitalIndex) => <HospitalResultCard key={hospital.id} hospital={hospital} detailQuery={detailQuery} priority={hospitalIndex < 3} soldOut={isHospitalSoldOut(hospital, startDate)} />)}
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
