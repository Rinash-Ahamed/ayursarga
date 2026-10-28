"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { verifyAdminEmail } from "@/services/auth/emailVerificationService";

export function EmailVerificationForm() {
  const [status, setStatus] = useState<"ready" | "busy" | "done" | "error">("ready");
  const [error, setError] = useState("");
  const code = useRef("");
  const submitting = useRef(false);
  useEffect(() => { code.current = new URLSearchParams(window.location.hash.slice(1)).get("oobCode") ?? ""; }, []);
  async function confirm() {
    if (submitting.current) return;
    submitting.current = true; setStatus("busy"); setError("");
    try {
      await verifyAdminEmail(code.current);
      code.current = ""; window.history.replaceState(null, "", window.location.pathname); setStatus("done");
    } catch { setError("This verification link is invalid, expired or already used. Return to Admin login to check your email status or request another link."); setStatus("error"); }
    finally { submitting.current = false; }
  }
  return <AuthFormShell title="Verify Admin email" description="Verify your email before setting up authenticator protection.">
    {status === "done" ? <div className="portal-auth-confirmation" role="status">Email verified. Return to Admin login to finish authenticator setup.</div> : <div className="portal-auth-form">
      {error && <p className="portal-form-error" role="alert">{error}</p>}
      <button type="button" disabled={status === "busy"} onClick={() => void confirm()}>{status === "busy" ? "Verifying..." : "Verify email"}</button>
    </div>}
    <div className="portal-auth-links"><Link href="/admin/login">Return to Admin login</Link></div>
  </AuthFormShell>;
}
