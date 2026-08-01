"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit as limitResults,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
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
};

export type QueryPage<T> = {
  documents: DocumentRecord<T>[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

export async function readDocument<T>(collectionPath: string, id: string) {
  const snapshot = await getDoc(doc(getClientFirestore(), collectionPath, id));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as DocumentRecord<T>) : null;
}

export async function createDocument(
  collectionPath: string,
  data: DocumentData,
  id?: string,
) {
  if (id) {
    await setDoc(doc(getClientFirestore(), collectionPath, id), data);
    return id;
  }
  const reference = await addDoc(collection(getClientFirestore(), collectionPath), data);
  return reference.id;
}

export async function updateDocument(collectionPath: string, id: string, data: DocumentData) {
  await updateDoc(doc(getClientFirestore(), collectionPath, id), data);
}

export async function deleteDocument(collectionPath: string, id: string) {
  await deleteDoc(doc(getClientFirestore(), collectionPath, id));
}

export async function runFilteredQuery<T>(options: QueryPageOptions): Promise<QueryPage<T>> {
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const constraints: QueryConstraint[] = (options.filters ?? []).map((filter) =>
    where(filter.field, filter.operator, filter.value));

  if (options.sort) constraints.push(orderBy(options.sort.field, options.sort.direction));
  if (options.cursor) constraints.push(startAfter(options.cursor));
  constraints.push(limitResults(pageSize + 1));

  const snapshot = await getDocs(query(collection(getClientFirestore(), options.collectionPath), ...constraints));
  const visible = snapshot.docs.slice(0, pageSize);
  return {
    documents: visible.map((item) => ({ id: item.id, ...item.data() } as DocumentRecord<T>)),
    cursor: visible.at(-1) ?? null,
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
