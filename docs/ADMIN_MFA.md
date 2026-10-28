# Admin authenticator MFA

## Current rollout status (28 October 2026)

Implementation is prepared in v4.23.0, not deployed. The first enablement attempt
returned `auth/operation-not-allowed` on standard Firebase Authentication. The
owner subsequently upgraded to Identity Platform. A read-only check confirmed
`IDENTITY_PLATFORM`; the previously authorized enablement then succeeded. A fresh
independent check confirmed `mfaEnabled=true` and `totpEnabled=true`. No accounts
were enrolled/changed and no application or Firestore rules were deployed.
Capability is now available, but Admin-only enforcement still requires coordinated
application/rules rollout and real enrollment validation.

Passed 43 focused route/service contracts and 21 browser regression cases on
desktop Chromium, 320px Chromium and mobile WebKit. Auth/email operations were
mocked, not live enrollment/delivery proof. Firestore emulator tests were added
but not run: only Java 8 is installed, while the CLI requires Java 21. Build,
lint and typecheck were not requested or run for this implementation.

Admin uses Firebase Authentication's native TOTP multi-factor authentication.
Firestore stores neither the setup secret nor one-time codes. Hospital and
Consumer accounts are not required to enroll by Ayursarga.

## Before rollout

1. Upgrade Firebase Authentication to Identity Platform in the Firebase/Google
   Cloud console. Review its current pricing; Blaze alone does not enable TOTP.
2. With the owner's authorization, enable the project TOTP capability. The
   operator tool does not run automatically:

   ```powershell
   node --env-file=.env.local scripts/configure-admin-mfa.mjs --check
   node --env-file=.env.local scripts/configure-admin-mfa.mjs --enable
   ```

   The first command is read-only. The second changes Auth configuration for
   `ayursarga-connect`, preserving other MFA provider settings. It does not force
   Hospital/Consumer enrollment. Do not run it against a different project.
3. Release application code and the matching Firestore rules together after
   validation. Rules-only deployment will lock password-only Admin access in old
   clients without providing the new setup UI. Application-only rollout leaves
   old deployed Firestore permissions unprotected. Existing Admin sessions must
   sign in with an authenticator; do not add a password-only fallback.
4. Test with the real project's configuration in a controlled operator session.
   Local mocked tests and emulator JWTs do not prove deployed Auth TOTP works.

## First setup

- Sign in at `/admin/login` using the existing email/password. Operational Admin
  access remains locked while setup is incomplete.
- If the email is not verified, explicitly request the branded verification
  email. Its recipient comes from the verified token and active Admin profile,
  never client input. Open the link, confirm verification, return and continue.
- Open an authenticator app, add a time-based account manually and enter the
  displayed private setup key. No external QR image service receives that key.
- Enter the app's six-digit code to enroll with Firebase. If Firebase's enrollment
  token does not contain MFA sign-in proof, sign in again with password and code.
- Future sign-ins require both the existing password and a native Firebase TOTP
  challenge. Password reset does not remove the enrolled factor.

## Enforcement and recovery

- Shared server authorization and Firestore rules require a verified email,
  password provider and Firebase `sign_in_second_factor: totp` for Admin access.
  Profile booleans/custom claims named `mfaVerified` are not substitutes.
- Own-profile reading remains available for role discovery; the existing narrowly
  email-locked missing-Admin bootstrap and recent-password-only verification-email
  action remain limited setup exceptions, not operational authorization.
- The shared Auth context never exposes an authorized Admin profile before MFA.
  Native Firebase enrollment is an Auth operation, not a Firestore transaction;
  no claim of atomic Firestore auditing of native Auth changes is made. Use the
  project's Identity Platform/Cloud audit logging for native factor changes and
  review its logging configuration/retention before production rollout.
- No self-service factor removal, emailed MFA bypass, recovery-code invention or
  automatic Auth account deletion is provided. Securely back up the authenticator.
  If it is lost, the trusted Firebase project owner must independently verify
  identity, record the recovery action, reset the factor through privileged Auth
  administration and revoke refresh tokens. This requires a separate explicitly
  authorized recovery operation, not a support-email request alone.
- Clearing audit history requires both the Admin password and a fresh authenticator
  code; existing destructive confirmation and recent-auth checks still apply.

References: [Firebase TOTP MFA](https://firebase.google.com/docs/auth/web/totp-mfa),
[Identity Platform pricing](https://cloud.google.com/identity-platform/pricing).
