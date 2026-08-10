"use client";

import { getClientAuth } from "@/services/auth/client";

export async function clearAllAuditLogs() {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in as Admin before clearing audit logs.");
  const token = await user.getIdToken();
  const result = await fetch("/api/admin/audits", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await result.json() as { deletedCount?: number; error?: string };
  if (!result.ok) throw new Error(body.error || "We could not clear the audit log.");
  return body.deletedCount ?? 0;
}
