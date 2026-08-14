"use client";

import { authorizedApiRequest } from "@/services/api/client";

export async function clearAllAuditLogs() {
  const body = await authorizedApiRequest<{ deletedCount?: number }>("/api/admin/audits", {
    method: "DELETE",
    signedOutMessage: "Sign in as Admin before clearing audit logs.",
    failureMessage: "We could not clear the audit log.",
  });
  return body.deletedCount ?? 0;
}
