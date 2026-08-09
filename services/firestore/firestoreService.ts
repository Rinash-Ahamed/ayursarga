"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit as limitResults,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type FieldPath,
  type OrderByDirection,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WhereFilterOp,
} from "firebase/firestore";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/constants/firestore";
import { getClientFirestore } from "@/services/firestore/client";

export type DocumentRecord<T> = T & { id: string };

export type QueryFilter = {
  field: string | FieldPath;
  operator: WhereFilterOp;
  value: unknown;
};

export type QueryPageOptions = {
  collectionPath: string;
  filters?: QueryFilter[];
  sort?: { field: string | FieldPath; direction?: OrderByDirection };
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  excludeArchived?: boolean;
};

export type QueryPage<T> = {
  documents: DocumentRecord<T>[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

export function emptyQueryPage<T>(): QueryPage<T> {
  return { documents: [], cursor: null, hasMore: false };
}

export async function readDocument<T>(collectionPath: string, id: string) {
  const snapshot = await getDoc(doc(getClientFirestore(), collectionPath, id));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as DocumentRecord<T>) : null;
}

export async function runFilteredQuery<T>(options: QueryPageOptions): Promise<QueryPage<T>> {
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const constraints: QueryConstraint[] = (options.filters ?? []).map((filter) =>
    where(filter.field, filter.operator, filter.value));

  if (options.sort) constraints.push(orderBy(options.sort.field, options.sort.direction));
  if (options.cursor) constraints.push(startAfter(options.cursor));
  constraints.push(limitResults(pageSize + 1));

  const snapshot = await getDocs(query(collection(getClientFirestore(), options.collectionPath), ...constraints));
  const page = snapshot.docs.slice(0, pageSize);
  const visible = options.excludeArchived === false
    ? page
    : page.filter((item) => item.data().status !== "archived" && item.data().archivedAt == null);
  return {
    documents: visible.map((item) => ({ id: item.id, ...item.data() } as DocumentRecord<T>)),
    cursor: page.at(-1) ?? null,
    hasMore: snapshot.docs.length > pageSize,
  };
}

export async function countDocuments(collectionPath: string, filters: QueryFilter[] = []) {
  const constraints = filters.map((filter) => where(filter.field, filter.operator, filter.value));
  const snapshot = await getCountFromServer(query(collection(getClientFirestore(), collectionPath), ...constraints));
  return snapshot.data().count;
}

export const firestoreTimestamp = {
  now: () => Timestamp.now(),
  server: () => serverTimestamp(),
  toDate: (value: unknown) => {
    if (value instanceof Timestamp) return value.toDate();
    return null;
  },
};
