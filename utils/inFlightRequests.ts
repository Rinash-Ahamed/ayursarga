const pending = new Map<string, Promise<unknown>>();

/** Share only overlapping identical requests. Never cache outcomes or retry writes. */
export function shareInFlightRequest<T>(key: string | null, request: () => Promise<T>): Promise<T> {
  if (key === null) return request();
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const result = Promise.resolve().then(request).finally(() => {
    if (pending.get(key) === result) pending.delete(key);
  });
  pending.set(key, result);
  return result;
}
