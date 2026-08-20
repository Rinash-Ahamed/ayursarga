"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const PublicHospitalSearch = dynamic(() => import("@/components/PublicHospitalSearch"), {
  ssr: false,
  loading: () => <SearchPlaceholder />,
});

function SearchPlaceholder() {
  return (
    <section
      id="search-centers"
      className="section public-center-search public-search-placeholder"
      tabIndex={-1}
    >
      <div className="section-inner">
        <div className="public-search-status" role="status">Preparing center search...</div>
      </div>
    </section>
  );
}

export default function DeferredPublicHospitalSearch() {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const target = placeholderRef.current;
    if (!target || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { threshold: 0.01 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (shouldLoad) return <PublicHospitalSearch />;

  return (
    <div ref={placeholderRef}>
      <SearchPlaceholder />
    </div>
  );
}
