import "server-only";

import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from "firebase-admin/app";

/** Server-only Admin SDK initialized through Application Default Credentials. */
export function getFirebaseAdminApp(): App {
  if (getApps().length) return getApp();

  const usingEmulators = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST,
  );
  const options: AppOptions = {};
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!usingEmulators) options.credential = applicationDefault();
  if (projectId) options.projectId = projectId;

  return initializeApp(options);
}
