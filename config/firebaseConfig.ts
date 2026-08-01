import type { FirebaseOptions } from "firebase/app";

const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} satisfies FirebaseOptions;

const requiredClientConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseClientConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseClientConfig.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseClientConfig.projectId,
  NEXT_PUBLIC_FIREBASE_APP_ID: firebaseClientConfig.appId,
};

const numberFromEnvironment = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const firebaseEmulatorConfig = {
  enabled: process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true",
  host: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1",
  authPort: numberFromEnvironment(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT, 9099),
  firestorePort: numberFromEnvironment(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT, 8080),
} as const;

export function isFirebaseClientConfigured() {
  return Object.values(requiredClientConfig).every(Boolean);
}

export function getFirebaseClientConfig(): FirebaseOptions {
  const missing = Object.entries(requiredClientConfig)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Firebase client configuration is incomplete. Missing: ${missing.join(", ")}`);
  }

  return firebaseClientConfig;
}

export function getFirebaseEmulatorConfig() {
  return firebaseEmulatorConfig;
}
