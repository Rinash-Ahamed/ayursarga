"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import { getClientAuth } from "@/services/auth/client";

export async function sendHospitalLoginSetup(hospitalId: string) {
  const auth = getClientAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in as Admin before preparing the Hospital login.");
  const token = await user.getIdToken();
  const result = await fetch(`/api/admin/hospitals/${encodeURIComponent(hospitalId)}/login-setup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await result.json() as { email?: string; error?: string };
  if (!result.ok || !body.email) throw new Error(body.error || "We could not prepare the Hospital login.");
  await sendPasswordResetEmail(auth, body.email);
  return body.email;
}
