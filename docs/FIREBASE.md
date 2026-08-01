# Firebase foundation

The current scope uses Spark-compatible Firebase Authentication, Cloud
Firestore, static Firebase Hosting, Security Rules, and the Local Emulator
Suite. Cloud Functions and Firebase Storage are intentionally not configured.

## Project setup

1. Create a Firebase project on the Spark plan and register a Web app.
2. Enable Email/Password in Authentication > Sign-in method.
3. Create the default Cloud Firestore database and choose the required region.
4. Copy `.env.example` to `.env.local` and replace the four
   `NEXT_PUBLIC_FIREBASE_*` placeholders from the Web app configuration.
5. For production Admin SDK access, use Application Default Credentials. Never
   commit a service-account JSON file or expose it through `NEXT_PUBLIC_*`.
6. Replace the demo alias with the real project using `firebase use --add`
   before deploying Firestore rules.
7. Deploy the rules and composite indexes with
   `npm run firebase:deploy:firestore` after reviewing the selected project.

The browser Firebase app, Authentication, and Firestore instances are created
once in `services/firebase/client.ts`. The `NEXT_PUBLIC_` prefix is required by
Next.js for values that must be available to the Firebase Web SDK.

## Local emulators

Set the following in `.env.local` while testing locally:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-ayursarga.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-ayursarga
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true
FIREBASE_ADMIN_PROJECT_ID=demo-ayursarga
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

Run `npm run firebase:emulators` in one terminal and `npm run dev` in another.
The Emulator UI is available at `http://127.0.0.1:4000`.
The Firestore emulator requires a local Java runtime; Auth and Hosting do not.
Run `npm run firebase:test:auth` for an isolated Auth emulator verification of
registration, email/password login, password reset, and cleanup.

## Privileged account provisioning

Public registration can only create consumers. After creating and approving a
hospital document, provision a hospital user from a trusted workstation with
Application Default Credentials:

```bash
npm run firebase:provision-user -- hospital hospital@example.com "temporary-password" "Hospital Manager" hospitalDocumentId
```

Provision the first admin similarly, without a hospital ID:

```bash
npm run firebase:provision-user -- admin admin@example.com "temporary-password" "Platform Admin"
```

The script creates the Firebase Auth user, assigns the signed `role` custom
claim, and creates the matching Firestore profile. Never run it in browser code
or expose Admin SDK credentials to the client.

## Hosting constraint

Firebase Hosting is configured for static files in `out/` and does not contain
Functions or Cloud Run rewrites. The current public site has a Node.js contact
endpoint at `/api/contact`, so a Firebase Hosting deployment must not replace
the existing Node-capable deployment until a fresh static-export strategy and
an external replacement for that endpoint are intentionally approved. This
preserves the working contact form and keeps the Firebase project Spark-only.
