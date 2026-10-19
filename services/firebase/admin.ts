import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getFirebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY are required on the server.");
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

export function isFirebaseAdminReady() {
  try {
    getFirebaseAdminApp();
    return true;
  } catch {
    return false;
  }
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminStorageBucket() {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucket || !/^[a-z0-9][a-z0-9._-]+$/.test(bucket)) {
    throw new Error("Hospital image uploads are unavailable. Set FIREBASE_STORAGE_BUCKET to your Firebase Storage bucket name.");
  }
  return getStorage(getFirebaseAdminApp()).bucket(bucket);
}

export function isFirebaseAdminStorageReady() {
  try {
    getFirebaseAdminStorageBucket();
    return true;
  } catch {
    return false;
  }
}
