"use client";

import { useCallback } from "react";
import type { ServiceDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listHospitalServices } from "@/services/hospitals/serviceService";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { formatServiceDuration } from "@/utils/duration";

export function AdminHospitalPackages({ hospitalId }: { hospitalId: string }) {
  const loader = useCallback(
    (cursor: QueryPageOptions["cursor"]) => listHospitalServices(hospitalId, { pageSize: 20, cursor }),
    [hospitalId],
  );
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<ServiceDocument>(
    loader,
    "We could not load this hospital's packages. Refresh the page and try again.",
  );

  return <section className="portal-detail-section" aria-labelledby="hospital-packages-title">
    <div className="portal-row-heading">
      <div>
        <span className="portal-eyebrow">Hospital catalogue</span>
        <h2 id="hospital-packages-title">Packages and services</h2>
      </div>
      {!isLoading && <span className="portal-status">{items.length}{hasMore ? "+" : ""} listed</span>}
    </div>
    <PortalFeedback
      error={error}
      empty={!error && !isLoading && items.length === 0
        ? "This hospital has not added any packages or services yet."
        : undefined}
    />
    <div className="portal-list">
      {items.map((service) => <article className="portal-row" key={service.id}>
        <div>
          <h3>{service.name}</h3>
          <p>{service.description || "No description provided."}</p>
          <div className="portal-card-meta">
            <span>{formatCurrency(service.price)}</span>
            <span>{formatServiceDuration(service.durationMinutes, service.durationUnit)}</span>
          </div>
        </div>
        <span className="portal-status" data-status={service.status}>{formatStatus(service.status)}</span>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </section>;
}
