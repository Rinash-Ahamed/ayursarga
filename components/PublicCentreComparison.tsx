"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { listPublicHospitalServices, searchPublicHospitals } from "@/services/hospitals/publicHospitalService";
import { packageProcedureEntries } from "@/features/hospitals/packages";

type ComparisonCentre = {
  hospital: DocumentRecord<HospitalDocument>;
  detailHref: string;
};

type ComparisonResult = {
  centre: ComparisonCentre;
  packages: Map<number, DocumentRecord<ServiceDocument>>;
};

function packageMap(services: DocumentRecord<ServiceDocument>[]) {
  const packages = new Map<number, DocumentRecord<ServiceDocument>>();
  services.forEach((service) => {
    if (service.status === "active" && typeof service.packageDurationDays === "number" && !packages.has(service.packageDurationDays)) {
      packages.set(service.packageDurationDays, service);
    }
  });
  return packages;
}

function SearchCentreField({ label, selected, excludedId, onSelect, onRemove }: {
  label: string;
  selected: ComparisonCentre | null;
  excludedId?: string;
  onSelect: (hospital: DocumentRecord<HospitalDocument>) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (selected || term.length < 2) return;
    const version = ++requestVersion.current;
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      void searchPublicHospitals(term, { pageSize: 8 }).then((page) => {
        if (requestVersion.current !== version) return;
        setOptions(page.documents.filter((hospital) => hospital.id !== excludedId));
      }).catch(() => {
        if (requestVersion.current !== version) return;
        setOptions([]);
        setError("We could not search centers right now.");
      }).finally(() => {
        if (requestVersion.current === version) setIsLoading(false);
      });
    }, 280);
    return () => {
      window.clearTimeout(timeout);
      requestVersion.current += 1;
    };
  }, [excludedId, query, selected]);

  if (selected) return <div className="public-comparison-picker is-selected">
    <span>{label}</span>
    <div>
      <strong>{selected.hospital.name}</strong>
      <small>{selected.hospital.city}{selected.hospital.district ? `, ${selected.hospital.district}` : ""}, {selected.hospital.state}</small>
    </div>
    <button type="button" onClick={() => { setQuery(""); setOptions([]); onRemove(); }}>Change</button>
  </div>;

  const showOptions = query.trim().length >= 2 && !isLoading;
  return <div className="public-comparison-picker" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOptions([]);
  }}>
    <label>
      <span>{label}</span>
      <div>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
        <input
          type="search"
          value={query}
          placeholder="Search center by name"
          autoComplete="off"
          role="combobox"
          aria-expanded={showOptions}
          aria-autocomplete="list"
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setError(null);
            if (value.trim().length < 2) {
              requestVersion.current += 1;
              setOptions([]);
              setIsLoading(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOptions([]);
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    </label>
    {isLoading && <small className="public-comparison-picker-status">Searching centers...</small>}
    {error && <small className="public-comparison-picker-status error" role="alert">{error}</small>}
    {showOptions && <div className="public-comparison-picker-options" role="listbox" aria-label={`${label} search results`}>
      {options.length > 0 ? options.map((hospital) => <button key={hospital.id} type="button" role="option" aria-selected="false" onClick={() => {
        setQuery("");
        setOptions([]);
        onSelect(hospital);
      }}>
        <strong>{hospital.name}</strong>
        <span>{hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</span>
      </button>) : <p>No matching active center found.</p>}
    </div>}
  </div>;
}

function PackageColumn({ result, duration }: { result: ComparisonResult; duration: number }) {
  const carePackage = result.packages.get(duration);
  if (!carePackage) return null;
  const procedures = packageProcedureEntries(carePackage);
  return <article className="public-comparison-package">
    <h4>{result.centre.hospital.name}</h4>
    {typeof carePackage.price === "number" && <strong className="public-comparison-price">₹{carePackage.price.toLocaleString("en-IN")}</strong>}
    <span>{procedures.length} {procedures.length === 1 ? "procedure" : "procedures"} included</span>
    {carePackage.description && <p>{carePackage.description}</p>}
    <ul>
      {procedures.map((procedure) => <li key={procedure.id}>
        <span>{procedure.label}</span>
        {procedure.days !== null && <strong>{procedure.days} {procedure.days === 1 ? "day" : "days"}</strong>}
      </li>)}
    </ul>
    <Link href={result.centre.detailHref}>View center details</Link>
  </article>;
}

export function PublicCentreComparison({ detailQuery }: { detailQuery: string }) {
  const [selected, setSelected] = useState<[ComparisonCentre | null, ComparisonCentre | null]>([null, null]);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  function selectCentre(index: 0 | 1, hospital: DocumentRecord<HospitalDocument>) {
    const suffix = detailQuery ? `?${detailQuery}` : "";
    setSelected((current) => {
      const next: [ComparisonCentre | null, ComparisonCentre | null] = [...current];
      next[index] = { hospital, detailHref: `/centers/${encodeURIComponent(hospital.id)}${suffix}` };
      return next;
    });
    setResults(null);
    setError(null);
  }

  function removeCentre(index: 0 | 1) {
    setSelected((current) => {
      const next: [ComparisonCentre | null, ComparisonCentre | null] = [...current];
      next[index] = null;
      return next;
    });
    setResults(null);
    setError(null);
  }

  async function compareCenters() {
    const centers = selected.filter((item): item is ComparisonCentre => item !== null);
    if (centers.length !== 2 || isLoading) return;
    setIsLoading(true);
    setError(null);
    setResults(null);
    try {
      const servicePages = await Promise.all(centers.map((item) => listPublicHospitalServices(item.hospital.id, { pageSize: 24 })));
      setResults(centers.map((centre, index) => ({ centre, packages: packageMap(servicePages[index].documents) })));
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const comparison = comparisonRef.current;
        if (!comparison) return;
        comparison.focus({ preventScroll: true });
        comparison.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }));
    } catch {
      setError("We could not load the package comparison. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedCount = selected.filter(Boolean).length;
  const commonDurations = results?.length === 2
    ? [...results[0].packages.keys()].filter((duration) => results[1].packages.has(duration)).sort((left, right) => left - right)
    : [];

  return <section className="public-comparison-workspace" aria-labelledby="center-comparison-title">
    <div className="public-comparison-intro">
      <span>Compare care options</span>
      <h2 id="center-comparison-title">Compare two Ayurvedic centers</h2>
      <p>Search and select two centers to compare package durations, prices, and included procedures.</p>
    </div>
    <div className="public-comparison-toolbar">
      <div className="public-comparison-searches">
        <SearchCentreField label="First center" selected={selected[0]} excludedId={selected[1]?.hospital.id} onSelect={(hospital) => selectCentre(0, hospital)} onRemove={() => removeCentre(0)} />
        <SearchCentreField label="Second center" selected={selected[1]} excludedId={selected[0]?.hospital.id} onSelect={(hospital) => selectCentre(1, hospital)} onRemove={() => removeCentre(1)} />
      </div>
      <div className="public-comparison-actions">
        {selectedCount > 0 && <button type="button" className="public-comparison-clear" onClick={() => { setSelected([null, null]); setResults(null); setError(null); }}>Clear</button>}
        <button type="button" className="public-comparison-start" disabled={selectedCount !== 2 || isLoading} onClick={() => void compareCenters()}>
          {isLoading ? "Comparing..." : "Compare packages"}
        </button>
      </div>
    </div>

    {(results || error) && <div className="public-comparison-results" ref={comparisonRef} tabIndex={-1}>
      <div className="public-comparison-results-heading">
        <div><span>Side-by-side comparison</span><h2>Matching care packages</h2></div>
        <button type="button" onClick={() => { setResults(null); setError(null); }} aria-label="Close package comparison">&times;</button>
      </div>
      {error && <p className="public-comparison-error" role="alert">{error}</p>}
      {!error && commonDurations.length === 0 && <div className="public-comparison-empty">
        <strong>No matching package duration is currently available.</strong>
        <p>Change one center to compare another pair.</p>
      </div>}
      {!error && results && commonDurations.map((duration) => <section className="public-comparison-duration" key={duration}>
        <h3>{duration}-day package</h3>
        <div className="public-comparison-columns">
          {results.map((result) => <PackageColumn key={result.centre.hospital.id} result={result} duration={duration} />)}
        </div>
      </section>)}
    </div>}
  </section>;
}
