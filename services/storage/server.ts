import "server-only";

import { getStorage, type Storage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "@/services/firebase/admin";

export function getServerStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}
