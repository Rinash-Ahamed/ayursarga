export function PortalResultCount({ count, singular, plural = `${singular}s`, hasMore = false }: {
  count: number;
  singular: string;
  plural?: string;
  hasMore?: boolean;
}) {
  const label = count === 1 ? singular : plural;
  return <div className="portal-result-count" role="status" aria-label={`Showing ${count} ${label}${hasMore ? ", more available" : ""}`}>
    <span>Showing</span>
    <strong>{count}</strong>
    <span>{label}</span>
    {hasMore && <span className="portal-result-more">More available</span>}
  </div>;
}
