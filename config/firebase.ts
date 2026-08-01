import type { FirebaseOptions } from "firebase/app";

const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} satisfies FirebaseOptions;

const requiredClientConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseClientConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseClientConfig.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseClientConfig.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseClientConfig.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseClientConfig.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: firebaseClientConfig.appId,
};

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
