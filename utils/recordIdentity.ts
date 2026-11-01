/** Stable identity/order; a later snapshot of the same document wins. */
export function uniqueRecords<T extends { id: string }>(records: readonly T[]): T[] {
  return [...new Map(records.map(record => [record.id, record])).values()];
}

/** Incoming pages cannot overwrite records already patched in the local list. */
export function appendUniqueRecords<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const existing = uniqueRecords(current);
  const ids = new Set(existing.map(record => record.id));
  return [...existing, ...uniqueRecords(incoming).filter(record => !ids.has(record.id))];
}
