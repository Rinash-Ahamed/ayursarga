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
import { PortalDialog } from "@/components/portal/PortalDialog";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/hooks/useAuth";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { formatStatus } from "@/utils/text";
import { toDate } from "@/utils/date";

type AuditCursor = QueryPageOptions["cursor"];
type DateRange = "" | "today" | "7days" | "30days";
type AuditRow = DocumentRecord<AuditLogDocument> & {
  actorName: string;
  activityLabel: string;
  areaLabel: string;
  recordLabel: string;
  changeLabel: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Added",
  update: "Updated",
  archive: "Archived",
  restore: "Restored",
  status_change: "Status changed",
  contract_generated: "Contract generated",
  contract_signed: "Contract signed",
  hospital_activated: "Hospital activated",
};

const RECORD_LABELS: Record<string, string> = {
  users: "User profile",
  hospitals: "Hospital",
  consultants: "Consultant",
  availability: "Availability request",
  services: "Service package",
  bookings: "Booking",
};

function formatDate(value: unknown) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown time";
}

function areaLabel(module: string) {
  const labels: Record<string, string> = {
    users: "Users",
    hospitals: "Hospitals",
    consultants: "Our Consultants",
    availability: "Availability",
    services: "Services",
    bookings: "Bookings",
  };
  return labels[module] ?? formatStatus(module);
}

function readableRole(role: string) {
  if (role === "admin") return "Admin";
  if (role === "hospital") return "Hospital";
  if (role === "consumer") return "Consumer";
  return formatStatus(role);
}

function textValue(values: Record<string, unknown> | null | undefined, key: string) {
  const value = values?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function auditRecordLabel(item: DocumentRecord<AuditLogDocument>) {
  for (const source of [item.updatedValues, item.previousValues]) {
    for (const key of ["name", "hospitalName", "consumerName", "title", "email"]) {
      const label = textValue(source, key);
      if (label) return label;
    }
  }
  const duration = item.updatedValues?.packageDurationDays ?? item.previousValues?.packageDurationDays;
  if (typeof duration === "number" && Number.isFinite(duration)) return `${duration}-day package`;
  return RECORD_LABELS[item.module] ?? `${areaLabel(item.module)} record`;
}

function auditActivityLabel(item: DocumentRecord<AuditLogDocument>) {
  const subject = RECORD_LABELS[item.module] ?? areaLabel(item.module);
  if (item.action === "status_change") {
    const status = textValue(item.updatedValues, "status") ?? textValue(item.updatedValues, "treatmentStatus");
    return status ? `${subject} changed to ${formatStatus(status)}` : `${subject} status changed`;
  }
  if (item.action === "contract_generated") return "Hospital contract generated";
  if (item.action === "contract_signed") return "Hospital contract marked as signed";
  if (item.action === "hospital_activated") return "Hospital activated";
  return `${subject} ${(ACTION_LABELS[item.action] ?? formatStatus(item.action)).toLowerCase()}`;
}

function auditChangeLabel(item: DocumentRecord<AuditLogDocument>) {
  const previousStatus = textValue(item.previousValues, "status") ?? textValue(item.previousValues, "treatmentStatus");
  const updatedStatus = textValue(item.updatedValues, "status") ?? textValue(item.updatedValues, "treatmentStatus");
  if (previousStatus && updatedStatus && previousStatus !== updatedStatus) {
    return `${formatStatus(previousStatus)} to ${formatStatus(updatedStatus)}`;
  }
  return null;
}

export function AdminAuditLogs() {
  const { reauthenticate } = useAuth();
  const [items, setItems] = useState<DocumentRecord<AuditLogDocument>[]>([]);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<AuditCursor[]>([null]);
  const [nextCursor, setNextCursor] = useState<AuditCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useRepeatableMessage();
  const [message, setMessage] = useRepeatableMessage();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [activity, setActivity] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("");
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
  }, [cursor, pageIndex, reloadVersion, setActionError]);

  const rows = useMemo<AuditRow[]>(() => items.map((item) => ({
    ...item,
    actorName: actorNames.get(item.actorId) ?? readableRole(item.actorRole),
    activityLabel: auditActivityLabel(item),
    areaLabel: areaLabel(item.module),
    recordLabel: auditRecordLabel(item),
    changeLabel: auditChangeLabel(item),
  })), [actorNames, items]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const earliest = dateRange === "today"
      ? startOfToday
      : dateRange === "7days"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000)
        : dateRange === "30days"
          ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000)
          : null;

    return rows.filter((item) => {
      const timestamp = toDate(item.timestamp);
      const matchesQuery = !query || [item.activityLabel, item.areaLabel, item.recordLabel, item.actorName, readableRole(item.actorRole)]
        .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesQuery
        && (!area || item.module === area)
        && (!activity || item.action === activity)
        && (!earliest || Boolean(timestamp && timestamp >= earliest));
    });
  }, [activity, area, dateRange, rows, search]);

  const hasFilters = Boolean(search.trim() || area || activity || dateRange);

  function clearFilters() {
    setSearch("");
    setArea("");
    setActivity("");
    setDateRange("");
  }

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
    if (!adminPassword) {
      setActionError("Enter your Admin password to confirm this permanent action.");
      return;
    }
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await reauthenticate(adminPassword);
      const deletedCount = await clearAllAuditLogs();
      setPageIndex(0);
      setPageCursors([null]);
      setReloadVersion((current) => current + 1);
      setMessage(`${deletedCount} audit ${deletedCount === 1 ? "record" : "records"} permanently cleared.`);
      setClearDialogOpen(false);
      setAdminPassword("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not clear the audit log.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="admin" title="Audit Logs">
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/admin" loadingMessage="Loading recent activity…" />
    <div className="portal-audit-heading">
      <div><h2>Platform activity</h2><p>Review who changed what and when. The newest 20 activities are shown on each page.</p></div>
      <button className="portal-button danger" type="button" disabled={busy || isLoading || items.length === 0} onClick={() => setClearDialogOpen(true)}>{busy ? "Clearing…" : "Clear all audits"}</button>
    </div>
    <div className="portal-card portal-audit-filters" aria-label="Filter audit activity">
      <label className="portal-filter-field portal-audit-search"><span>Search this page</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hospital, person or activity" /></label>
      <label className="portal-filter-field"><span>Area</span><select value={area} onChange={(event) => setArea(event.target.value)}><option value="">All areas</option><option value="hospitals">Hospitals</option><option value="availability">Availability</option><option value="services">Services</option><option value="bookings">Bookings</option><option value="users">Users</option><option value="consultants">Our Consultants</option></select></label>
      <label className="portal-filter-field"><span>Activity</span><select value={activity} onChange={(event) => setActivity(event.target.value)}><option value="">All activities</option>{Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="portal-filter-field"><span>When</span><select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}><option value="">Any date</option><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option></select></label>
      <div className="portal-filter-actions"><button className="portal-button secondary" type="button" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button></div>
      <p className="portal-audit-filter-note">Filters apply to the 20 activities on this page. Use Previous or Next to review another page.</p>
    </div>
    <PortalToast message={actionError ?? message} tone={actionError ? "error" : "success"} />
    <PortalFeedback empty={!loadError && !isLoading && items.length === 0 ? "No audit records are available." : undefined} />
    {!isLoading && rows.length > 0 && filteredRows.length === 0 && <PortalFeedback empty="No activity on this page matches the selected filters." />}
    {filteredRows.length > 0 && <div className="portal-table-wrap">
      <table className="portal-audit-table">
        <thead><tr><th>What happened</th><th>Affected record</th><th>Performed by</th><th>When</th></tr></thead>
        <tbody>{filteredRows.map((item) => <tr key={item.id}>
          <td data-label="What happened"><strong>{item.activityLabel}</strong><small>{item.areaLabel}</small></td>
          <td data-label="Affected record"><strong>{item.recordLabel}</strong>{item.changeLabel && <small>{item.changeLabel}</small>}</td>
          <td data-label="Performed by"><strong>{item.actorName}</strong><small>{readableRole(item.actorRole)}</small></td>
          <td data-label="When">{formatDate(item.timestamp)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {rows.length > 0 && <div className="portal-audit-pagination" aria-label="Audit pagination">
      <button type="button" className="portal-button secondary" disabled={pageIndex === 0 || isLoading} onClick={previousPage}>Previous</button>
      <span>Page {pageIndex + 1}</span>
      <button type="button" className="portal-button secondary" disabled={!hasMore || isLoading} onClick={nextPage}>Next</button>
    </div>}
    <PortalDialog open={clearDialogOpen} tone="danger" title="Clear all audit history?" message="This permanently removes every audit record. Re-enter your Admin password to continue." confirmLabel="Clear audit history" busy={busy} onCancel={() => { setClearDialogOpen(false); setAdminPassword(""); }} onConfirm={() => void clearAudits()}>
      <PasswordField label="Admin password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" />
      {actionError && <p className="portal-form-error" role="alert">{actionError}</p>}
    </PortalDialog>
  </PortalShell>;
}
