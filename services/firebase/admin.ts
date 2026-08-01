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

  const options: AppOptions = { credential: applicationDefault() };
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (projectId) options.projectId = projectId;
  if (storageBucket) options.storageBucket = storageBucket;

  return initializeApp(options);
}
