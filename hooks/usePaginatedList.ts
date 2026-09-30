"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentRecord, QueryPage } from "@/services/firestore/firestoreService";

type PageCursor<TCursor> = TCursor | null;
type PageLoader<T, TCursor> = (cursor: PageCursor<TCursor>) => Promise<QueryPage<T, TCursor>>;

export function usePaginatedList<T, TCursor = NonNullable<QueryPage<T>["cursor"]>>(loader: PageLoader<T, TCursor>, errorMessage: string) {
  const [items, setItems] = useState<DocumentRecord<T>[]>([]);
  const [cursor, setCursor] = useState<PageCursor<TCursor>>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const load = useCallback(async (nextCursor: PageCursor<TCursor>, replace: boolean) => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    try {
      const page = await loader(nextCursor);
      if (version !== requestVersion.current) return;
      setItems((current) => replace ? page.documents : [
        ...current,
        ...page.documents.filter((item) => !current.some((existing) => existing.id === item.id)),
      ]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setError(null);
    } catch {
      if (version === requestVersion.current) setError(errorMessage);
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [errorMessage, loader]);

  const reload = useCallback(() => load(null, true), [load]);
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) return load(cursor, false);
    return Promise.resolve();
  }, [cursor, hasMore, isLoading, load]);
  const patchItem = useCallback((id: string, changes: Partial<T>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }, []);
  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void reload(); }, 0);
    return () => {
      window.clearTimeout(timeout);
      requestVersion.current += 1;
    };
  }, [reload]);

  return { items, error, isLoading, hasMore, reload, loadMore, patchItem, removeItem };
}
