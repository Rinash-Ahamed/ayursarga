"use client";

import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseClientApp } from "@/services/firebase/client";

export function getClientStorage(): FirebaseStorage {
  return getStorage(getFirebaseClientApp());
}
