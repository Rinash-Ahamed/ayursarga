"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import { authorizedApiRequest } from "@/services/api/client";
import { getClientAuth } from "@/services/auth/client";

export async function sendHospitalLoginSetup(hospitalId: string) {
  const auth = getClientAuth();
  const body = await authorizedApiRequest<{ email?: string }>(`/api/admin/hospitals/${encodeURIComponent(hospitalId)}/login-setup`, {
    method: "POST",
    signedOutMessage: "Sign in as Admin before preparing the Hospital login.",
    failureMessage: "We could not prepare the Hospital login.",
  });
  if (!body.email) throw new Error("We could not prepare the Hospital login.");
  await sendPasswordResetEmail(auth, body.email);
  return body.email;
}
