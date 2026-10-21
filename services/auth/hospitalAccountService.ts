"use client";

import { authorizedApiRequest } from "@/services/api/client";

export async function sendHospitalLoginSetup(hospitalId: string) {
  const body = await authorizedApiRequest<{ email?: string; emailSent?: boolean }>(`/api/admin/hospitals/${encodeURIComponent(hospitalId)}/login-setup`, {
    method: "POST",
    signedOutMessage: "Sign in as Admin before preparing the Hospital login.",
    failureMessage: "We could not prepare the Hospital login.",
  });
  if (!body.email || body.emailSent !== true) throw new Error("The Hospital invitation email was not confirmed as sent. Retry the login setup.");
  return body.email;
}
