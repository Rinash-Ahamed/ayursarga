import "server-only";

import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/services/firebase/admin";

export function getServerFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
