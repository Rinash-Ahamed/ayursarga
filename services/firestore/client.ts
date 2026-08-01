"use client";

import type { Firestore } from "firebase/firestore";
import { getFirebaseClientServices } from "@/services/firebase/client";

export function getClientFirestore(): Firestore {
  return getFirebaseClientServices().firestore;
}
