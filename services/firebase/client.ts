"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirebaseClientConfig } from "@/config/firebase";

/** Lazily initializes Firebase so the public website does not load it. */
export function getFirebaseClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(getFirebaseClientConfig());
}
