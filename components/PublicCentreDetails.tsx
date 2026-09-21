"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { listPublicHospitalServices } from "@/services/hospitals/publicHospitalService";
import { getHospitalImageUrls } from "@/features/hospitals/images";
import { resolveCentreGuidelines } from "@/features/hospitals/guidelines";
import { groupHospitalFacilities } from "@/features/hospitals/facilities";
import { packageProcedureEntries, packageTitle } from "@/features/hospitals/packages";
import { FacilityIcon } from "@/components/icons/FacilityIcon";
import { addCentreSearchContext, formatBystanders, type CentreSearchContext } from "@/features/hospitals/searchContext";
import { usePaginatedList } from "@/hooks/usePaginatedList";

function formatCareDates(context: CentreSearchContext) {
  if (!context.startDate && !context.endDate) return "Dates are flexible";
  const format = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!context.endDate || context.startDate === context.endDate) return format(context.startDate || context.endDate);
  return `${format(context.startDate)} to ${format(context.endDate)}`;
}

function CentreGallery({ hospital }: { hospital: DocumentRecord<HospitalDocument> }) {
  const originalImages = getHospitalImageUrls(hospital);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const images = originalImages.filter((image) => !failedImages.includes(image));
  const [activeImage, setActiveImage] = useState(0);
  const selectedImage = images[Math.min(activeImage, Math.max(images.length - 1, 0))];

  if (!selectedImage) return <div className="public-centre-gallery-empty"><span>Ayursarga</span><p>Centre images will appear here when available.</p></div>;

  const visibleThumbnails = images.filter((image) => image !== selectedImage).slice(0, 3);
  return <div className="public-centre-gallery" aria-label={`${hospital.name} image gallery`}>
    <div className="public-centre-gallery-main">
      {/* Approved external HTTPS and Google Drive images are rendered without proxying or extra reads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={selectedImage} src={selectedImage} alt={`${hospital.name} centre`} referrerPolicy="no-referrer" onError={() => setFailedImages((current) => [...current, selectedImage])} />
    </div>
    {visibleThumbnails.length > 0 && <div className="public-centre-gallery-thumbs">
      {visibleThumbnails.map((image, index) => <button type="button" key={image} onClick={() => setActiveImage(images.indexOf(image))} aria-label={`Show centre image ${images.indexOf(image) + 1}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImages((current) => [...current, image])} />
        {index === 2 && images.length > 4 && <span>+{images.length - 4} images</span>}
      </button>)}
    </div>}
    {images.length > 1 && <div className="public-centre-gallery-dots">{images.map((image, index) => <button type="button" className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)} aria-label={`Show image ${index + 1}`} aria-pressed={index === activeImage} key={image} />)}</div>}
  </div>;
}

export default function PublicCentreDetails({ hospitalId, searchContext, initialService = "", searchTerm = "" }: { hospitalId: string; searchContext: CentreSearchContext; initialService?: string; searchTerm?: string }) {
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [hospitalLoading, setHospitalLoading] = useState(true);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(() => new Set());
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listPublicHospitalServices(hospitalId, { pageSize: 12, cursor }), [hospitalId]);
  const { items: services, error: serviceError, isLoading: servicesLoading, hasMore, loadMore } = usePaginatedList<ServiceDocument>(loader, "We could not load this centre's packages. Please try again.");

  useEffect(() => {
    let active = true;
    void getHospital(hospitalId).then((record) => {
      if (!active) return;
      if (!record || record.status !== "active" || !record.isPublic) {
        setHospitalError("This Ayurvedic centre is not currently available for public discovery.");
        return;
      }
      setHospital(record);
    }).catch(() => {
      if (active) setHospitalError("We could not load this Ayurvedic centre. Please return to search and try again.");
    }).finally(() => {
      if (active) setHospitalLoading(false);
    });
    return () => { active = false; };
  }, [hospitalId]);

  const backHref = useMemo(() => {
    const params = addCentreSearchContext(new URLSearchParams(), searchContext);
    if (initialService) params.set("service", initialService);
    if (searchTerm) params.set("q", searchTerm);
    return `/centers?${params.toString()}`;
  }, [initialService, searchContext, searchTerm]);

  if (hospitalLoading) return <section className="section public-centre-detail-page"><div className="section-inner"><div className="public-centre-detail-status" role="status">Preparing centre details…</div></div></section>;
  if (hospitalError || !hospital) return <section className="section public-centre-detail-page"><div className="section-inner"><div className="public-centre-detail-status error" role="alert"><strong>Centre details unavailable</strong><p>{hospitalError}</p><Link href={backHref}>Return to centre search</Link></div></div></section>;

  const guidelines = resolveCentreGuidelines(hospital);
  const additionalRules = hospital.additionalCentreRules?.trim();
  const { groups: facilityGroups, custom: customFacilities, hasFacilities } = groupHospitalFacilities(hospital.facilities);
  const primaryHospitalPhone = hospital.hospitalPhone1?.trim() || hospital.phone;
  const secondaryHospitalPhone = hospital.hospitalPhone2?.trim();

  return <section className="section public-centre-detail-page">
    <div className="section-inner public-centre-detail-inner">
      <Link href={backHref} className="public-centre-back">← Back to centre search</Link>
      <nav className="public-centre-detail-nav" aria-label="Centre details sections">
        <a href="#overview">Overview</a><a href="#packages">Services</a><a href="#facilities">Facilities</a><a href="#rules">Centre Rules</a><a href="#legal">Legal and Policies</a><a href="#reviews">Guest Reviews</a>
      </nav>

      <header className="public-centre-detail-header">
        <div>
          <span className="eyebrow">Ayursarga partner centre</span>
          <h1>{hospital.name}</h1>
          <p className="public-centre-address"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-6.2 6-12A6 6 0 1 0 6 9c0 5.8 6 12 6 12Z" /><circle cx="12" cy="9" r="2" /></svg>{hospital.address}, {hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</p>
          {hospital.ayursargaRating && <div className="public-center-assessment" aria-label={`Ayursarga assessment ${hospital.ayursargaRating} out of 5`}><span className="public-center-stars" aria-hidden="true"><span>★★★★★</span><span style={{ width: `${hospital.ayursargaRating / 5 * 100}%` }}>★★★★★</span></span><strong>{hospital.ayursargaRating.toFixed(1)}</strong></div>}
        </div>
        <a className="public-centre-primary-action" href="#packages">Choose a package</a>
      </header>

      <CentreGallery hospital={hospital} />

      <div className="public-centre-context" aria-label="Selected care preferences">
        <div><span>Preferred care dates</span><strong>{formatCareDates(searchContext)}</strong></div>
        <div><span>Accompanying support</span><strong>{formatBystanders(searchContext.bystanders)}</strong></div>
        <Link href={backHref}>Change search</Link>
      </div>

      <div className="public-centre-content-grid">
        <main>
          <section id="overview" className="public-centre-content-section">
            <span className="eyebrow">Overview</span><h2>Care at {hospital.name}</h2>
            <p>{hospital.description || "Explore the Ayurvedic treatments and practical centre information available through Ayursarga."}</p>
            {hospital.ayursargaReviewNote && <blockquote>{hospital.ayursargaReviewNote}</blockquote>}
          </section>

          <section id="packages" className="public-centre-content-section">
            <span className="eyebrow">Available packages</span><h2>Choose the care you would like to discuss</h2>
            {serviceError && <div className="public-centre-inline-error" role="alert">{serviceError}</div>}
            {servicesLoading && services.length === 0 && <p role="status">Loading available packages...</p>}
            {!servicesLoading && !serviceError && services.length === 0 && <p>No active packages are listed for this centre yet.</p>}
            <div className="public-centre-services">{services.map((service) => {
              const bookingParams = addCentreSearchContext(new URLSearchParams({ hospitalId: hospital.id, serviceId: service.id }), searchContext);
              const procedures = packageProcedureEntries(service);
              const expanded = expandedPackages.has(service.id);
              return <article className="public-centre-package" key={service.id}>
                <div className="public-centre-package-copy">
                  <h3>{packageTitle(service)}</h3>
                  <p>{service.description || `${procedures.length} procedures included in this package.`}</p>
                  {service.packageDurationDays && <span>{service.packageDurationDays} days</span>}
                  {procedures.length > 0 && <button className="public-package-toggle" type="button" aria-expanded={expanded} onClick={() => setExpandedPackages((current) => {
                    const next = new Set(current);
                    if (next.has(service.id)) next.delete(service.id);
                    else next.add(service.id);
                    return next;
                  })}>{expanded ? "View less" : "View more"}</button>}
                  {expanded && <ul className="public-package-procedures">{procedures.map((procedure) => <li key={procedure.id}><span>{procedure.label}</span><strong>{procedure.days} {procedure.days === 1 ? "day" : "days"}</strong></li>)}</ul>}
                </div>
                <div><Link href={`/app/bookings/new?${bookingParams.toString()}`}>Request appointment</Link></div>
              </article>;
            })}</div>
            {hasMore && <button className="public-load-more" type="button" disabled={servicesLoading} onClick={() => void loadMore()}>{servicesLoading ? "Loading..." : "Show more packages"}</button>}
          </section>

          <section id="facilities" className="public-centre-content-section">
            <span className="eyebrow">Facilities</span><h2>Practical comforts at the centre</h2>
            {hasFacilities ? <div className="public-centre-facility-groups">
              {facilityGroups.map((group) => <section key={group.title}>
                <h3>{group.title}</h3>
                <ul className="public-centre-facilities">{group.options.map((facility) => <li key={facility}><FacilityIcon facility={facility} /><span>{facility}</span></li>)}</ul>
              </section>)}
              {customFacilities.length > 0 && <section>
                <h3>Other facilities</h3>
                <ul className="public-centre-facilities">{customFacilities.map((facility, index) => <li key={`${facility}-${index}`}><FacilityIcon facility={facility} /><span>{facility}</span></li>)}</ul>
              </section>}
            </div> : <div className="public-centre-empty-note">This centre has not added its facilities yet. Contact the centre before requesting care if you need a particular facility.</div>}
          </section>

          <section id="rules" className="public-centre-content-section public-centre-rules-section">
            <span className="eyebrow">Before your visit or stay</span><h2>Centre guidelines</h2><p>Please review the centre’s guidelines before sending an appointment request.</p>
            <ol>{guidelines.map((guideline) => <li key={guideline.id}><div><strong>{guideline.title}</strong><p>{guideline.body}</p></div></li>)}{additionalRules && <li><div><strong>Additional Centre Rules</strong><p>{additionalRules}</p></div></li>}</ol>
          </section>

          <section id="legal" className="public-centre-content-section">
            <span className="eyebrow">Legal and policies</span><h2>Important centre information</h2>
            {hospital.legalPolicies?.trim() ? <p className="public-centre-policy-copy">{hospital.legalPolicies}</p> : <div className="public-centre-empty-note">No additional centre-specific legal or policy information has been published. Ask the centre about cancellation, payment, and treatment policies before confirming care.</div>}
          </section>

          <section id="reviews" className="public-centre-content-section">
            <span className="eyebrow">Guest reviews</span><h2>Verified care experiences</h2>
            <div className="public-centre-empty-note">No verified guest reviews are available yet. Ayursarga will display reviews here only when they are linked to a completed booking.</div>
          </section>
        </main>

        <aside className="public-centre-contact-card">
          <span>Centre information</span><h2>Speak with the centre</h2>
          <p>Contact the centre for practical questions. Treatment suitability is confirmed by its qualified clinical team.</p>
          <a href={`tel:${primaryHospitalPhone}`}>{primaryHospitalPhone}</a>
          {secondaryHospitalPhone && <a href={`tel:${secondaryHospitalPhone}`}>{secondaryHospitalPhone}</a>}
          <a href={`mailto:${hospital.email}`}>{hospital.email}</a>
          {hospital.locationUrl && <div className="public-centre-location">
            <span>Centre location</span>
            <p>{hospital.address}, {hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</p>
            <a href={hospital.locationUrl} target="_blank" rel="noopener noreferrer">Open location in maps <span aria-hidden="true">↗</span></a>
          </div>}
        </aside>
      </div>
    </div>
  </section>;
}
