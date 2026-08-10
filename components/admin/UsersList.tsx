"use client";

import { useCallback, useState } from "react";
import type { UserDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listUsers } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { usePaginatedList } from "@/hooks/usePaginatedList";

type UserGroup = "consumer" | "hospital";

export function UsersList() {
  const [group, setGroup] = useState<UserGroup>("consumer");
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) =>
    listUsers(group, { pageSize: 20, cursor }), [group]);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<UserDocument>(
    loader,
    `We could not load the ${group} users. Refresh the page and try again.`,
  );
  const groupLabel = group === "consumer" ? "Consumer" : "Hospital";

  return <PortalShell role="admin" title="Users">
    <PortalLoadGuard loading={isLoading} error={error} hasData={items.length > 0} fallbackHref="/admin" loadingMessage={`Loading ${group.toLowerCase()} users…`} />
    <p className="portal-empty portal-users-guidance">Choose a user group below to view its accounts. Admin accounts are managed separately.</p>
    <div className="portal-segmented" role="group" aria-label="User group">
      <button type="button" aria-pressed={group === "consumer"} onClick={() => setGroup("consumer")}>Consumers</button>
      <button type="button" aria-pressed={group === "hospital"} onClick={() => setGroup("hospital")}>Hospitals</button>
    </div>
    <PortalFeedback error={items.length > 0 ? error : null} empty={!error && !isLoading && items.length === 0
      ? `No ${groupLabel.toLowerCase()} users yet. New ${groupLabel.toLowerCase()} accounts will appear here.`
      : undefined} />
    <div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}>
      <div><h3>{item.name}</h3><p>{item.email}{item.phone ? ` · ${item.phone}` : ""}{item.hospitalId ? ` · Hospital ${item.hospitalId}` : ""}</p>{group === "consumer" && item.address && <p>{item.address}</p>}</div>
      <span className="portal-status" data-status={item.status}>{item.status}</span>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
