"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditLogDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { listAuditLogs } from "@/services/firestore/auditService";
import { clearAllAuditLogs } from "@/services/audit/adminAuditService";
import { getUserDisplayNames } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { formatStatus } from "@/utils/text";
import { toDate } from "@/utils/date";

type AuditCursor = QueryPageOptions["cursor"];

function formatDate(value: unknown) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date) : "Unknown time";
}

function areaLabel(module: string) {
  const labels: Record<string, string> = {
    users: "Users",
    hospitals: "Hospitals",
    services: "Services",
    bookings: "Bookings",
  };
  return labels[module] ?? formatStatus(module);
}

export function AdminAuditLogs() {
  const [items, setItems] = useState<DocumentRecord<AuditLogDocument>[]>([]);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<AuditCursor[]>([null]);
  const [nextCursor, setNextCursor] = useState<AuditCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestVersion = useRef(0);
  const cursor = pageCursors[pageIndex] ?? null;

  useEffect(() => {
    const version = ++requestVersion.current;
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      void listAuditLogs({ pageSize: 20, cursor }).then(async (page) => {
        const names = await getUserDisplayNames(page.documents.map((item) => item.actorId)).catch(() => new Map<string, string>());
        if (version !== requestVersion.current) return;
        setItems(page.documents);
        setActorNames(names);
        setNextCursor(page.cursor);
        setHasMore(page.hasMore);
      }).catch(() => {
        if (version !== requestVersion.current) return;
        if (pageIndex > 0) {
          setActionError("We could not open the next audit page. The previous page is shown.");
          setPageIndex((current) => Math.max(0, current - 1));
        } else {
          setItems([]);
          setLoadError("We could not load the audit log.");
        }
      }).finally(() => {
        if (version === requestVersion.current) setIsLoading(false);
      });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      requestVersion.current += 1;
    };
  }, [cursor, pageIndex, reloadVersion]);

  const rows = useMemo(() => items.map((item) => ({
    ...item,
    actorName: actorNames.get(item.actorId) ?? formatStatus(item.actorRole),
  })), [actorNames, items]);

  function nextPage() {
    if (!hasMore || !nextCursor || isLoading) return;
    setActionError(null);
    setPageCursors((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((current) => current + 1);
  }

  function previousPage() {
    if (pageIndex === 0 || isLoading) return;
    setActionError(null);
    setPageIndex((current) => current - 1);
  }

  async function clearAudits() {
    if (busy) return;
    const confirmation = window.prompt("This permanently deletes every audit record. Type CLEAR to continue.");
    if (confirmation !== "CLEAR") return;
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const deletedCount = await clearAllAuditLogs();
      setPageIndex(0);
      setPageCursors([null]);
      setReloadVersion((current) => current + 1);
      setMessage(`${deletedCount} audit ${deletedCount === 1 ? "record" : "records"} permanently cleared.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not clear the audit log.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="admin" title="Audit Logs">
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={false} fallbackHref="/admin" loadingMessage="Loading recent activity…" />
    <div className="portal-audit-heading">
      <p>Showing the newest platform activity, 20 records per page.</p>
      <button className="portal-button danger" type="button" disabled={busy || isLoading || items.length === 0} onClick={() => void clearAudits()}>
        {busy ? "Clearing…" : "Clear all audits"}
      </button>
    </div>
    <PortalToast message={actionError ?? message} tone={actionError ? "error" : "success"} />
    <PortalFeedback empty={!loadError && !isLoading && items.length === 0 ? "No audit records are available." : undefined} />
    {rows.length > 0 && <div className="portal-table-wrap">
      <table className="portal-audit-table">
        <thead><tr><th>Activity</th><th>Area</th><th>Performed by</th><th>Date</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id}>
          <td><strong>{formatStatus(item.action)}</strong></td>
          <td>{areaLabel(item.module)}</td>
          <td><strong>{item.actorName}</strong><small>{formatStatus(item.actorRole)}</small></td>
          <td>{formatDate(item.timestamp)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {rows.length > 0 && <div className="portal-audit-pagination" aria-label="Audit pagination">
      <button type="button" className="portal-button secondary" disabled={pageIndex === 0 || isLoading} onClick={previousPage}>Previous</button>
      <span>Page {pageIndex + 1}</span>
      <button type="button" className="portal-button secondary" disabled={!hasMore || isLoading} onClick={nextPage}>Next</button>
    </div>}
  </PortalShell>;
}
