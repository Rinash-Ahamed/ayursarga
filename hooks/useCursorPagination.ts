"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentRecord, QueryPage } from "@/services/firestore/firestoreService";

type PageCursor<T> = QueryPage<T>["cursor"];
type PageLoader<T> = (cursor: PageCursor<T>) => Promise<QueryPage<T>>;

/** Cursor pagination that retains only the visible page of records in memory. */
export function useCursorPagination<T>(loader: PageLoader<T>, errorMessage: string) {
  const [items, setItems] = useState<DocumentRecord<T>[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<PageCursor<T>[]>([null]);
  const [nextCursor, setNextCursor] = useState<PageCursor<T>>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestVersion = useRef(0);
  const cursor = pageCursors[pageIndex] ?? null;

  useEffect(() => {
    const version = ++requestVersion.current;
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      void loader(cursor).then((page) => {
        if (version !== requestVersion.current) return;
        setItems(page.documents);
        setNextCursor(page.cursor);
        setHasMore(page.hasMore);
        setError(null);
      }).catch(() => {
        if (version !== requestVersion.current) return;
        setError(errorMessage);
      }).finally(() => {
        if (version === requestVersion.current) setIsLoading(false);
      });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      requestVersion.current += 1;
    };
  }, [cursor, errorMessage, loader, reloadVersion]);

  const nextPage = useCallback(() => {
    if (isLoading || !hasMore || !nextCursor) return;
    setPageCursors((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((current) => current + 1);
  }, [hasMore, isLoading, nextCursor, pageIndex]);

  const previousPage = useCallback(() => {
    if (isLoading || pageIndex === 0) return;
    setPageIndex((current) => current - 1);
  }, [isLoading, pageIndex]);

  const reload = useCallback(() => setReloadVersion((current) => current + 1), []);
  const reset = useCallback(() => {
    setPageCursors([null]);
    setPageIndex(0);
    setReloadVersion((current) => current + 1);
  }, []);

  return {
    items,
    error,
    isLoading,
    hasMore,
    page: pageIndex + 1,
    canGoBack: pageIndex > 0,
    reload,
    reset,
    nextPage,
    previousPage,
  };
}
