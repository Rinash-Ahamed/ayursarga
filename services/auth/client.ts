"use client";

import { getAuth, type Auth } from "firebase/auth";
import { getFirebaseClientApp } from "@/services/firebase/client";

export function getClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}
