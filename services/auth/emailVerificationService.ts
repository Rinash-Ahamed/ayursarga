"use client";

import { ActionCodeOperation, applyActionCode, checkActionCode } from "firebase/auth";
import { getClientAuth } from "@/services/auth/client";

export async function verifyAdminEmail(code: string) {
  if (!code) throw new Error("The verification link is missing its code.");
  const auth = getClientAuth();
  const action = await checkActionCode(auth, code);
  if (action.operation !== ActionCodeOperation.VERIFY_EMAIL) throw new Error("Use an email verification link, not a password reset link.");
  await applyActionCode(auth, code);
  if (auth.currentUser) { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); }
}
