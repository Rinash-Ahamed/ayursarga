"use client";

import { useCallback, useState } from "react";
import type { UserDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { archiveConsumer, listUsers } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalToast } from "@/components/portal/PortalToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";

type UserGroup = "consumer" | "hospital";

export function UsersList() {
  const [group, setGroup] = useState<UserGroup>("consumer");
  const [consumerToRemove, setConsumerToRemove] = useState<DocumentRecord<UserDocument> | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useRepeatableMessage();
  const [message, setMessage] = useRepeatableMessage();
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) =>
    listUsers(group, { pageSize: 20, cursor }), [group]);
  const { items, error, isLoading, hasMore, loadMore, removeItem } = usePaginatedList<UserDocument>(
    loader,
    `We could not load the ${group} users. Refresh the page and try again.`,
  );
  const groupLabel = group === "consumer" ? "Consumer" : "Hospital";

  function changeGroup(nextGroup: UserGroup) {
    setGroup(nextGroup);
    setConsumerToRemove(null);
    setActionError(null);
    setMessage(null);
  }

  async function removeConsumer() {
    if (!consumerToRemove) return;
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await archiveConsumer(consumerToRemove);
      removeItem(consumerToRemove.id);
      setMessage(`${consumerToRemove.name} has been removed from active consumers.`);
      setConsumerToRemove(null);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not remove this consumer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="admin" title="Users">
    <PortalLoadGuard loading={isLoading} error={error} hasData={items.length > 0} fallbackHref="/admin" loadingMessage={`Loading ${group.toLowerCase()} users...`} />
    <p className="portal-empty portal-users-guidance">Choose a user group below to view its accounts. Admin accounts are managed separately.</p>
    <div className="portal-segmented" role="group" aria-label="User group">
      <button type="button" aria-pressed={group === "consumer"} onClick={() => changeGroup("consumer")}>Consumers</button>
      <button type="button" aria-pressed={group === "hospital"} onClick={() => changeGroup("hospital")}>Hospitals</button>
    </div>
    <PortalFeedback error={items.length > 0 ? error : null} empty={!error && !isLoading && items.length === 0
      ? `No ${groupLabel.toLowerCase()} users yet. New ${groupLabel.toLowerCase()} accounts will appear here.`
      : undefined} />
    <PortalToast message={message} />
    <PortalToast message={actionError} tone="error" />
    <div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}>
      <div><h3>{item.name}</h3><p>{item.email}{item.phone ? ` · ${item.phone}` : ""}{item.hospitalId ? ` · Hospital ${item.hospitalId}` : ""}</p>{group === "consumer" && item.address && <p>{item.address}</p>}</div>
      <div className="portal-user-actions">
        <span className="portal-status" data-status={item.status}>{item.status}</span>
        {group === "consumer" && <button className="portal-button danger" type="button" disabled={busy} onClick={() => {
          setConsumerToRemove(item);
          setActionError(null);
          setMessage(null);
        }}>Remove</button>}
      </div>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalDialog
      open={Boolean(consumerToRemove)}
      title="Remove this consumer?"
      message={consumerToRemove ? `${consumerToRemove.name} will lose access and disappear from the active consumer list. Their booking history and audit records will remain safely stored.` : undefined}
      tone="danger"
      confirmLabel="Remove consumer"
      busy={busy}
      onConfirm={() => void removeConsumer()}
      onCancel={() => setConsumerToRemove(null)}
    />
  </PortalShell>;
}
