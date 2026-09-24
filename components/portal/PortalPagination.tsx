export function PortalPagination({
  hasMore,
  isLoading,
  onLoadMore,
  page,
  canGoBack = false,
  onPrevious,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  page?: number;
  canGoBack?: boolean;
  onPrevious?: () => void;
}) {
  const usesPages = page !== undefined && onPrevious !== undefined;
  if (!hasMore && (!usesPages || !canGoBack)) return null;

  if (usesPages) return <nav className="portal-pagination" aria-label="List pagination">
    <button type="button" className="portal-button secondary" disabled={!canGoBack || isLoading} onClick={onPrevious}>Previous</button>
    <span>Page {page}</span>
    <button type="button" className="portal-button secondary" disabled={!hasMore || isLoading} onClick={onLoadMore}>Next</button>
  </nav>;

  return <div className="portal-actions portal-load-more">
    <button type="button" className="portal-button secondary" disabled={isLoading} onClick={onLoadMore}>
      {isLoading ? "Loading..." : "Load more"}
    </button>
  </div>;
}
