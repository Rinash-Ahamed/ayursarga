"use client";

import { runFilteredQuery, type QueryPage, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/constants/firestore";
import { uniqueRecords } from "@/utils/recordIdentity";

export type StatusOrderedCursor = { phase: "current" | "inactive"; document: QueryPageOptions["cursor"] };
export type StatusOrderedOptions = { pageSize?: number; cursor?: StatusOrderedCursor | null; status?: "active" | "inactive" };

/** Exhaust current records before paging inactive ones; never download whole lists. */
export async function runStatusOrderedQuery<T>(options: Omit<QueryPageOptions, "cursor"> & StatusOrderedOptions): Promise<QueryPage<T, StatusOrderedCursor>> {
  const { cursor, status, ...base } = options;
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const load = (phase: StatusOrderedCursor["phase"], size: number, document?: QueryPageOptions["cursor"]) => runFilteredQuery<T>({
    ...base, pageSize: size, cursor: document,
    filters: [...(base.filters ?? []), { field: "status", operator: status || phase === "inactive" ? "==" : "in", value: status ?? (phase === "inactive" ? "inactive" : base.excludeArchived === false ? ["active", "pending", "archived"] : ["active", "pending"]) }],
  });
  const phase = status ? (status === "inactive" ? "inactive" : "current") : cursor?.phase ?? "current";
  const first = await load(phase, pageSize, cursor?.document);
  if (status || phase === "inactive" || first.hasMore) return { ...first, cursor: { phase, document: first.cursor } };
  const remaining = pageSize - first.documents.length;
  // A full current page needs only a bounded look-ahead into inactive records.
  const inactive = await load("inactive", remaining || 1);
  return {
    documents: uniqueRecords(remaining ? [...first.documents, ...inactive.documents] : first.documents),
    cursor: { phase: "inactive", document: remaining ? inactive.cursor : null },
    hasMore: remaining ? inactive.hasMore : inactive.documents.length > 0 || inactive.hasMore,
  };
}
