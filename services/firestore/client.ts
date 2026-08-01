"use client";

import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseClientApp } from "@/services/firebase/client";

export function getClientFirestore(): Firestore {
  return getFirestore(getFirebaseClientApp());
}
