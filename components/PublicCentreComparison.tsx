"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { HospitalDocument, ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { listPublicHospitalServices, searchPublicHospitals } from "@/services/hospitals/publicHospitalService";
import { packageProcedureEntries } from "@/features/hospitals/packages";
import { getHospitalImageUrls, hospitalImageSrcSet } from "@/features/hospitals/images";

type ComparisonCentre = {
  hospital: DocumentRecord<HospitalDocument>;
  detailHref: string;
};

type ComparisonResult = {
  centre: ComparisonCentre;
  packages: Map<number, DocumentRecord<ServiceDocument>>;
};

type SelectedCentre = ComparisonCentre & {
  packages: ComparisonResult["packages"] | null;
  error: string | null;
};

function ComparisonImage({ hospital }: { hospital: DocumentRecord<HospitalDocument> }) {
  const url = getHospitalImageUrls(hospital)[0];
  const [failed, setFailed] = useState(false);
  return <div className="public-comparison-image">
    {url && !failed
      // Uploaded and legacy external gallery images share responsive display helpers.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={url} srcSet={hospitalImageSrcSet(url)} sizes="(max-width: 700px) 90vw, 460px" width={1200} height={900} alt={`${hospital.name} Ayurvedic center`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span>Center image not available</span>}
  </div>;
}

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
  const optionsId = useId();

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
          aria-controls={optionsId}
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
    {showOptions && <div id={optionsId} className="public-comparison-picker-options" role="listbox" aria-label={`${label} search results`}>
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
    <ComparisonImage key={getHospitalImageUrls(result.centre.hospital)[0] ?? "no-image"} hospital={result.centre.hospital} />
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
  const [selected, setSelected] = useState<[SelectedCentre | null, SelectedCentre | null]>([null, null]);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [duration, setDuration] = useState("");
  const comparisonRef = useRef<HTMLDivElement>(null);
  const requestVersions = useRef<[number, number]>([0, 0]);
  const requests = useRef<[AbortController | null, AbortController | null]>([null, null]);
  const scrollFrame = useRef<number | null>(null);

  useEffect(() => {
    const versions = requestVersions.current;
    const controllers = requests.current;
    return () => {
      versions[0]++;
      versions[1]++;
      controllers.forEach((controller) => controller?.abort());
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  function resetComparison() {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    setResults(null);
    setDuration("");
  }

  async function loadPackages(index: 0 | 1, hospitalId: string) {
    const version = ++requestVersions.current[index];
    requests.current[index]?.abort();
    const controller = new AbortController();
    requests.current[index] = controller;
    try {
      const page = await listPublicHospitalServices(hospitalId, { pageSize: 24, signal: controller.signal });
      if (requestVersions.current[index] !== version) return;
      setSelected((current) => {
        const next: typeof current = [...current];
        const centre = current[index];
        if (centre?.hospital.id === hospitalId) next[index] = { ...centre, packages: packageMap(page.documents), error: null };
        return next;
      });
    } catch {
      if (requestVersions.current[index] !== version) return;
      setSelected((current) => {
        const next: typeof current = [...current];
        const centre = current[index];
        if (centre?.hospital.id === hospitalId) next[index] = { ...centre, error: "We could not load this center's packages." };
        return next;
      });
    }
  }

  function selectCentre(index: 0 | 1, hospital: DocumentRecord<HospitalDocument>) {
    const suffix = detailQuery ? `?${detailQuery}` : "";
    setSelected((current) => {
      const next: typeof current = [...current];
      next[index] = { hospital, detailHref: `/centers/${encodeURIComponent(hospital.id)}${suffix}`, packages: null, error: null };
      return next;
    });
    resetComparison();
    void loadPackages(index, hospital.id);
  }

  function removeCentre(index: 0 | 1) {
    requestVersions.current[index]++;
    requests.current[index]?.abort();
    setSelected((current) => {
      const next: typeof current = [...current];
      next[index] = null;
      return next;
    });
    resetComparison();
  }

  function compareCenters() {
    const [first, second] = selected;
    if (!duration || !first?.packages?.has(Number(duration)) || !second?.packages?.has(Number(duration))) return;
    setResults([{ centre: first, packages: first.packages }, { centre: second, packages: second.packages }]);
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = window.requestAnimationFrame(() => {
        const comparison = comparisonRef.current;
        if (!comparison) return;
        comparison.focus({ preventScroll: true });
        comparison.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      });
    });
  }

  const selectedCount = selected.filter(Boolean).length;
  const isLoading = selected.some((centre) => centre && !centre.packages && !centre.error);
  const firstPackages = selected[0]?.packages;
  const secondPackages = selected[1]?.packages;
  const ready = Boolean(firstPackages && secondPackages);
  const commonDurations = firstPackages && secondPackages
    ? [...firstPackages.keys()].filter((days) => secondPackages.has(days)).sort((left, right) => left - right)
    : [];

  return <section className="public-comparison-workspace" aria-labelledby="center-comparison-title">
    <div className="public-comparison-intro">
      <span>Compare care options</span>
      <h2 id="center-comparison-title">Compare two Ayurvedic centers</h2>
      <p>Select two centers and a matching package duration to compare prices and included procedures.</p>
    </div>
    <div className="public-comparison-toolbar">
      <div className="public-comparison-searches">
        {([0, 1] as const).map((index) => <div className="public-comparison-center-control" key={index}>
          <SearchCentreField label={index === 0 ? "First center" : "Second center"} selected={selected[index]} excludedId={selected[index === 0 ? 1 : 0]?.hospital.id} onSelect={(hospital) => selectCentre(index, hospital)} onRemove={() => removeCentre(index)} />
          {selected[index] && !selected[index].packages && !selected[index].error && <p className="public-comparison-package-status" role="status">Loading package choices...</p>}
          {selected[index]?.error && <p className="public-comparison-package-status error" role="alert">{selected[index].error} <button type="button" onClick={() => { const centre = selected[index]; if (centre) selectCentre(index, centre.hospital); }}>Retry</button></p>}
        </div>)}
        <label className="public-comparison-package-select">Package to compare
          <select value={duration} disabled={!ready || commonDurations.length === 0} onChange={(event) => { setDuration(event.target.value); setResults(null); }}>
            <option value="">{isLoading ? "Loading packages..." : !ready ? "Select both centers first" : commonDurations.length ? "Select package duration" : "No matching package duration"}</option>
            {commonDurations.map((days) => <option key={days} value={days}>{days}-day package</option>)}
          </select>
        </label>
      </div>
      <div className="public-comparison-actions">
        {selectedCount > 0 && <button type="button" className="public-comparison-clear" onClick={() => { requestVersions.current[0]++; requestVersions.current[1]++; requests.current.forEach((controller) => controller?.abort()); setSelected([null, null]); resetComparison(); }}>Clear</button>}
        <button type="button" className="public-comparison-start" disabled={!duration || !ready || isLoading} onClick={compareCenters}>
          Compare package
        </button>
      </div>
    </div>

    {ready && commonDurations.length === 0 && <div className="public-comparison-empty" role="status"><strong>No matching package duration is currently available.</strong><p>Change one center to compare another pair.</p></div>}
    {results && <div className="public-comparison-results" ref={comparisonRef} tabIndex={-1}>
      <div className="public-comparison-results-heading">
        <div><span>Side-by-side comparison</span><h2>{duration}-day care packages</h2></div>
        <button type="button" onClick={() => setResults(null)} aria-label="Close package comparison">&times;</button>
      </div>
      <section className="public-comparison-duration">
        <h3>{duration}-day package</h3>
        <div className="public-comparison-columns">
          {results.map((result) => <PackageColumn key={result.centre.hospital.id} result={result} duration={Number(duration)} />)}
        </div>
      </section>
    </div>}
  </section>;
}
