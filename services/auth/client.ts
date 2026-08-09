"use client";

import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { getFirebaseEmulatorConfig } from "@/config/firebaseConfig";
import { getFirebaseClientApp } from "@/services/firebase/client";

const firebaseGlobal = globalThis as typeof globalThis & { __ayursargaAuth?: Auth };

export function getClientAuth(): Auth {
  if (firebaseGlobal.__ayursargaAuth) return firebaseGlobal.__ayursargaAuth;
  const auth = getAuth(getFirebaseClientApp());
  const emulator = getFirebaseEmulatorConfig();
  if (emulator.enabled) {
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, { disableWarnings: true });
  }
  firebaseGlobal.__ayursargaAuth = auth;
  return auth;
}
