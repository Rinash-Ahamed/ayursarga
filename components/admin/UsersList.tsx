"use client";

import { useCallback } from "react";
import type { UserDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listUsers } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";

export function UsersList() {
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listUsers({ pageSize: 20, cursor }), []);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<UserDocument>(loader, "We could not load the user list. Refresh the page and try again.");
  return <PortalShell role="admin" title="Users"><p className="portal-empty" style={{ marginBottom: 20 }}>Use this page to view registered consumers and separately authorised Hospital and Admin accounts.</p><PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "No users yet. Registered and authorised accounts will appear here." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}><div><h3>{item.name}</h3><p>{item.email}{item.hospitalId ? ` · Hospital ${item.hospitalId}` : ""}</p></div><span className="portal-status" data-status={item.status}>{item.role} · {item.status}</span></article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} /></PortalShell>;
}
