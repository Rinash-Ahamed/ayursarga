"use client";

import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseEmulatorConfig } from "@/config/firebaseConfig";
import { getFirebaseClientApp } from "@/services/firebase/client";

const firebaseGlobal = globalThis as typeof globalThis & { __ayursargaFirestore?: Firestore };

export function getClientFirestore(): Firestore {
  if (firebaseGlobal.__ayursargaFirestore) return firebaseGlobal.__ayursargaFirestore;
  const firestore = getFirestore(getFirebaseClientApp());
  const emulator = getFirebaseEmulatorConfig();
  if (emulator.enabled) {
    connectFirestoreEmulator(firestore, emulator.host, emulator.firestorePort);
  }
  firebaseGlobal.__ayursargaFirestore = firestore;
  return firestore;
}
