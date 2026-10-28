type AuthErrorCode =
  | "configuration"
  | "invalid-credentials"
  | "email-in-use"
  | "weak-password"
  | "user-disabled"
  | "too-many-requests"
  | "network"
  | "email-delivery"
  | "database-permission"
  | "profile-not-found"
  | "profile-recovery"
  | "profile-invalid"
  | "role-mismatch"
  | "account-inactive"
  | "account-pending"
  | "unauthenticated"
  | "sign-in-cancelled"
  | "provider-conflict"
  | "mfa-required"
  | "mfa-enrollment-required"
  | "mfa-sign-in-required"
  | "mfa-invalid-code"
  | "mfa-session-expired"
  | "mfa-email-unverified"
  | "mfa-unavailable"
  | "unknown";

const MESSAGES: Record<AuthErrorCode, string> = {
  configuration: "Authentication is not configured yet.",
  "invalid-credentials": "The email address or password is incorrect.",
  "email-in-use": "An account already exists for this email address.",
  "weak-password": "Use at least 8 characters, including one letter and one digit.",
  "user-disabled": "This account has been disabled. Please contact support.",
  "too-many-requests": "Too many attempts. Please wait and try again.",
  network: "Unable to connect. Check your connection and try again.",
  "email-delivery": "Password reset email is temporarily unavailable. Please try again later or contact Ayursarga.",
  "database-permission": "Your account is authenticated but its database access is not configured.",
  "profile-not-found": "Your account profile could not be found.",
  "profile-recovery": "Your Admin profile could not be restored. Check the server Firebase Admin configuration and try again.",
  "profile-invalid": "Your account profile is incomplete.",
  "role-mismatch": "This account does not have access to this portal.",
  "account-inactive": "This account is currently inactive. Please contact support.",
  "account-pending": "This account is awaiting approval.",
  unauthenticated: "Please sign in to continue.",
  "sign-in-cancelled": "Google sign-in was cancelled. Please try again when you are ready.",
  "provider-conflict": "This email is already connected to another Ayursarga sign-in method. Please contact support.",
  "mfa-required": "Enter the six-digit code from your authenticator app.",
  "mfa-enrollment-required": "Set up your Admin authenticator to continue. Admin access is locked until verification is complete.",
  "mfa-sign-in-required": "Sign in again with your password and authenticator code to access Admin.",
  "mfa-invalid-code": "Enter a valid six-digit authenticator code. If it has expired, use the next code in your app.",
  "mfa-session-expired": "This verification session has expired. Please sign in again.",
  "mfa-email-unverified": "Verify your Admin email before setting up your authenticator.",
  "mfa-unavailable": "Authenticator setup is unavailable. Ask the project owner to enable Firebase Identity Platform and TOTP MFA.",
  unknown: "Authentication could not be completed. Please try again.",
};

export class AuthenticationError extends Error {
  readonly occurredAt = Date.now();
  constructor(public readonly code: AuthErrorCode, options?: { cause?: unknown }) {
    super(MESSAGES[code], options);
    this.name = "AuthenticationError";
  }
}

export function toAuthenticationError(error: unknown): AuthenticationError {
  if (error instanceof AuthenticationError) return error;

  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    const code: AuthErrorCode = ({
      "auth/invalid-credential": "invalid-credentials",
      "auth/configuration-not-found": "configuration",
      "auth/operation-not-allowed": "configuration",
      "auth/invalid-api-key": "configuration",
      "auth/invalid-email": "invalid-credentials",
      "auth/user-not-found": "invalid-credentials",
      "auth/wrong-password": "invalid-credentials",
      "auth/requires-recent-login": "invalid-credentials",
      "auth/email-already-in-use": "email-in-use",
      "auth/weak-password": "weak-password",
      "auth/user-disabled": "user-disabled",
      "auth/too-many-requests": "too-many-requests",
      "auth/network-request-failed": "network",
      "permission-denied": "database-permission",
      "firestore/permission-denied": "database-permission",
      "unavailable": "network",
      "firestore/unavailable": "network",
      "auth/id-token-expired": "unauthenticated",
      "auth/id-token-revoked": "unauthenticated",
      "auth/popup-closed-by-user": "sign-in-cancelled",
      "auth/cancelled-popup-request": "sign-in-cancelled",
      "auth/account-exists-with-different-credential": "provider-conflict",
      "auth/unauthorized-domain": "configuration",
      "auth/invalid-verification-code": "mfa-invalid-code",
      "auth/invalid-totp-code": "mfa-invalid-code",
      "auth/code-expired": "mfa-session-expired",
      "auth/invalid-multi-factor-session": "mfa-session-expired",
      "auth/missing-multi-factor-session": "mfa-session-expired",
      "auth/second-factor-already-in-use": "mfa-sign-in-required",
      "auth/unverified-email": "mfa-email-unverified",
      "auth/unsupported-first-factor": "mfa-unavailable",
      "auth/popup-blocked": "configuration",
    } as Record<string, AuthErrorCode>)[error.code] ?? "unknown";

    return new AuthenticationError(code, { cause: error });
  }

  if (error instanceof Error && error.message.startsWith("Firebase client configuration")) {
    return new AuthenticationError("configuration", { cause: error });
  }

  return new AuthenticationError("unknown", { cause: error });
}
