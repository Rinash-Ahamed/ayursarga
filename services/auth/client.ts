"use client";

import type { Auth } from "firebase/auth";
import { getFirebaseClientServices } from "@/services/firebase/client";

export function getClientAuth(): Auth {
  return getFirebaseClientServices().auth;
}
