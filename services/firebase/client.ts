"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseClientConfig, getFirebaseEmulatorConfig } from "@/config/firebaseConfig";

type FirebaseClientServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

const firebaseGlobal = globalThis as typeof globalThis & {
  __ayursargaFirebaseServices?: FirebaseClientServices;
};

/** Lazily initializes Firebase so the public website does not load it. */
export function getFirebaseClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(getFirebaseClientConfig());
}

/** Creates Auth and Firestore once, including one-time local emulator wiring. */
export function getFirebaseClientServices(): FirebaseClientServices {
  if (firebaseGlobal.__ayursargaFirebaseServices) return firebaseGlobal.__ayursargaFirebaseServices;

  const app = getFirebaseClientApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const emulator = getFirebaseEmulatorConfig();

  if (emulator.enabled) {
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, emulator.host, emulator.firestorePort);
  }

  const services = { app, auth, firestore };
  firebaseGlobal.__ayursargaFirebaseServices = services;
  return services;
}
