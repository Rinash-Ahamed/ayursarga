"use client";

import { useCallback, useRef, useState } from "react";
import type { UserDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import type { StatusOrderedCursor } from "@/services/firestore/statusOrderedQuery";
import { setUserAccountStatus, listUsers } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalToast } from "@/components/portal/PortalToast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatDisplayDateTime } from "@/utils/date";

type UserGroup = "consumer" | "hospital";

export function UsersList() {
  const [group, setGroup] = useState<UserGroup>("consumer");
  const [selectedUser, setSelectedUser] = useState<DocumentRecord<UserDocument> | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError, actionErrorNotification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const loader = useCallback((cursor: StatusOrderedCursor | null) =>
    listUsers(group, { pageSize: 20, cursor }), [group]);
  const { errorNotification: loadErrorNotification, items, error, isLoading, hasMore, loadMore, patchItem } = usePaginatedList<UserDocument, StatusOrderedCursor>(
    loader,
    `We could not load the ${group} users. Refresh the page and try again.`,
  );
  const groupLabel = group === "consumer" ? "Consumer" : "Hospital";

  function changeGroup(nextGroup: UserGroup) {
    if (submitting.current) return;
    setGroup(nextGroup);
    setSelectedUser(null);
    setActionError(null);
    setMessage(null);
  }

  async function changeAccountStatus() {
    if (!selectedUser || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const status = selectedUser.status === "active" ? "inactive" : "active";
      const changes = await setUserAccountStatus(selectedUser, status);
      patchItem(selectedUser.id, changes);
      setMessage(`${selectedUser.name}'s account is now ${status}.`);
      setSelectedUser(null);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not change this account. Try again.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return <PortalShell role="admin" title="Users">
    <PortalLoadGuard notification={loadErrorNotification} loading={isLoading} error={error} hasData={items.length > 0} fallbackHref="/admin" loadingMessage={`Loading ${group.toLowerCase()} users...`} />
    <p className="portal-empty portal-users-guidance">Choose a user group below to view its accounts. Admin accounts are managed separately.</p>
    <div className="portal-segmented" role="group" aria-label="User group">
      <button type="button" disabled={busy} aria-pressed={group === "consumer"} onClick={() => changeGroup("consumer")}>Consumers</button>
      <button type="button" disabled={busy} aria-pressed={group === "hospital"} onClick={() => changeGroup("hospital")}>Hospitals</button>
    </div>
    <PortalFeedback notification={loadErrorNotification} error={items.length > 0 ? error : null} emptyTitle={`No ${groupLabel.toLowerCase()} users yet`} empty={!error && !isLoading && items.length === 0
      ? `No ${groupLabel.toLowerCase()} users yet. New ${groupLabel.toLowerCase()} accounts will appear here.`
      : undefined} />
    <PortalToast message={message} notification={messageNotification} />
    <PortalToast message={actionError} notification={actionErrorNotification} tone="error" />
    <div className="admin-card-layout"><div className="portal-list admin-card-grid admin-user-grid">{items.map((item) => {
      const created = formatDisplayDateTime(item.createdAt);
      return <article className="portal-row" key={`${group}-${item.id}`}>
      <div><div className="admin-user-heading"><h3>{item.name}</h3><span className="portal-status" data-status={item.status}>{item.status}</span></div><p>{item.email}</p></div>
      <dl className="admin-card-facts"><div><dt>Created</dt><dd>{created ? `${created} IST` : "Not recorded"}</dd></div></dl>
      {(item.phone || item.address) && <details className="admin-user-contact">
        <summary aria-label={`Contact details for ${item.name}`}><span className="admin-user-show-more">Show more</span><span className="admin-user-show-less">Show less</span></summary>
        <dl className="admin-card-facts">
          {item.phone && <div><dt>Phone number</dt><dd>{item.phone}</dd></div>}
          {item.address && <div><dt>Address</dt><dd>{item.address}</dd></div>}
        </dl>
      </details>}
      <div className="portal-user-actions">
        {["active", "inactive"].includes(item.status) && <button className={`portal-button ${item.status === "active" ? "danger" : "primary"}`} type="button" disabled={busy} onClick={() => {
          setSelectedUser(item);
          setActionError(null);
          setMessage(null);
        }}>{item.status === "active" ? "Make inactive" : "Make active"}</button>}
      </div>
    </article>;
    })}</div></div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalDialog
      open={Boolean(selectedUser)}
      title={selectedUser?.status === "active" ? "Make this account inactive?" : "Make this account active?"}
      message={selectedUser ? `${selectedUser.name} ${selectedUser.status === "active" ? "will no longer be able to use their portal. Their account stays in this list and can be made active again" : "will be able to use their portal again"}. Profiles and booking history are kept.${selectedUser.role === "hospital" ? " This changes login access only, not the centre's public listing or existing bookings." : ""}` : undefined}
      tone={selectedUser?.status === "active" ? "danger" : undefined}
      confirmLabel={selectedUser?.status === "active" ? "Make inactive" : "Make active"}
      busy={busy}
      onConfirm={() => void changeAccountStatus()}
      onCancel={() => { if (!submitting.current) setSelectedUser(null); }}
    >{actionError && <p className="portal-field-error" role="alert">{actionError}</p>}</PortalDialog>
  </PortalShell>;
}
