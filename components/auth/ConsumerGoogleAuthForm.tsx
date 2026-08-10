"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";

export function ConsumerGoogleAuthForm({ mode, requestedPath }: {
  mode: "login" | "register";
  requestedPath?: string | null;
}) {
  const { loginConsumerWithGoogle, isLoading, error, clearError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const register = mode === "register";

  async function continueWithGoogle() {
    clearError();
    setLocalError(null);
    try {
      await loginConsumerWithGoogle(requestedPath);
    } catch (caught) {
      if (!(caught instanceof Error)) setLocalError("Google sign-in could not be completed. Please try again.");
    }
  }

  return <AuthFormShell
    eyebrow="Consumer account"
    title={register ? "Create your account" : "Welcome back"}
    description="Continue securely with Google to discover hospitals, request appointments and manage your bookings."
  >
    <div className="portal-auth-form">
      <PortalToast message={localError || error?.message} tone="error" />
      <button type="button" onClick={() => void continueWithGoogle()} disabled={isLoading}>
        <svg className="portal-google-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
          <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
          <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 5.9Z" />
        </svg>
        {isLoading ? "Connecting..." : "Continue with Google"}
      </button>
    </div>
    <div className="portal-auth-links">
      <Link href={register ? ROUTES.consumer.login : ROUTES.consumer.register}>
        {register ? "Already registered? Sign in" : "New to Ayursarga? Create an account"}
      </Link>
    </div>
  </AuthFormShell>;
}
