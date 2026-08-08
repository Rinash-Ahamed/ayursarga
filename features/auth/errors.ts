export type AuthErrorCode =
  | "configuration"
  | "invalid-credentials"
  | "email-in-use"
  | "weak-password"
  | "user-disabled"
  | "too-many-requests"
  | "network"
  | "profile-not-found"
  | "profile-invalid"
  | "role-mismatch"
  | "account-inactive"
  | "account-pending"
  | "unauthenticated"
  | "unknown";

const MESSAGES: Record<AuthErrorCode, string> = {
  configuration: "Authentication is not configured yet.",
  "invalid-credentials": "The email address or password is incorrect.",
  "email-in-use": "An account already exists for this email address.",
  "weak-password": "Use at least 8 characters, including one letter and one digit.",
  "user-disabled": "This account has been disabled. Please contact support.",
  "too-many-requests": "Too many attempts. Please wait and try again.",
  network: "Unable to connect. Check your connection and try again.",
  "profile-not-found": "Your account profile could not be found.",
  "profile-invalid": "Your account profile is incomplete.",
  "role-mismatch": "This account does not have access to this portal.",
  "account-inactive": "This account is currently inactive. Please contact support.",
  "account-pending": "This account is awaiting approval.",
  unauthenticated: "Please sign in to continue.",
  unknown: "Authentication could not be completed. Please try again.",
};

export class AuthenticationError extends Error {
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
      "auth/invalid-email": "invalid-credentials",
      "auth/user-not-found": "invalid-credentials",
      "auth/wrong-password": "invalid-credentials",
      "auth/email-already-in-use": "email-in-use",
      "auth/weak-password": "weak-password",
      "auth/user-disabled": "user-disabled",
      "auth/too-many-requests": "too-many-requests",
      "auth/network-request-failed": "network",
      "auth/id-token-expired": "unauthenticated",
      "auth/id-token-revoked": "unauthenticated",
    } as Record<string, AuthErrorCode>)[error.code] ?? "unknown";

    return new AuthenticationError(code, { cause: error });
  }

  if (error instanceof Error && error.message.startsWith("Firebase client configuration")) {
    return new AuthenticationError("configuration", { cause: error });
  }

  return new AuthenticationError("unknown", { cause: error });
}
