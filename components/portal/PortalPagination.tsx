export function PortalPagination({
  hasMore,
  isLoading,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;
  return <div className="portal-actions" style={{ justifyContent: "center", marginTop: 22 }}>
    <button type="button" className="portal-button secondary" disabled={isLoading} onClick={onLoadMore}>
      {isLoading ? "Loading…" : "Load more"}
    </button>
  </div>;
}
