// Explicit operator tool. Never runs during build, deployment or application startup.
// --check is read-only; --enable needs the owner's separate authorization.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const mode = process.argv[2];
if (!["--check", "--enable"].includes(mode)) throw new Error("Use --check (read-only) or --enable (changes Firebase Auth configuration).");
if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "ayursarga-connect") throw new Error("This tool is restricted to ayursarga-connect.");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
if (!clientEmail || !privateKey) throw new Error("Server Firebase Admin credentials are required.");
try {
  const credential = cert({ projectId: "ayursarga-connect", clientEmail, privateKey });
  const manager = getAuth(initializeApp({ projectId: "ayursarga-connect", credential })).projectConfigManager();
  // Admin SDK omits this safe discriminator; never print the raw config response.
  const access = await credential.getAccessToken();
  const response = await fetch("https://identitytoolkit.googleapis.com/v2/projects/ayursarga-connect/config", {
    headers: { Authorization: `Bearer ${access.access_token}` }, signal: AbortSignal.timeout(8000),
  });
  const raw = response.ok ? await response.json() : {};
  const subtype = ["FIREBASE_AUTH", "IDENTITY_PLATFORM"].includes(raw.subtype) ? raw.subtype : "unknown";
  if (mode === "--enable" && subtype === "FIREBASE_AUTH") {
    throw Object.assign(new Error("Identity Platform upgrade requires owner action in the console."), { code: "IDENTITY_PLATFORM_UPGRADE_REQUIRED" });
  }
  const config = (await manager.getProjectConfig()).multiFactorConfig;
  const existing = config?.providerConfigs ?? [];
  if (mode === "--enable") {
    // Enables project capability, not mandatory enrollment for Hospital/Consumer users.
    // Retain other provider settings; never replace existing factors/accounts.
    const totp = existing.find((provider) => provider.totpProviderConfig);
    await manager.updateProjectConfig({ multiFactorConfig: {
      ...config, state: "ENABLED",
      providerConfigs: [...existing.filter((provider) => !provider.totpProviderConfig),
        { state: "ENABLED", totpProviderConfig: totp?.totpProviderConfig ?? { adjacentIntervals: 1 } }],
    } });
  }
  const current = (await manager.getProjectConfig()).multiFactorConfig;
  console.log(JSON.stringify({ project: "ayursarga-connect", mode, subtype, mfaEnabled: current?.state === "ENABLED",
    totpEnabled: current?.providerConfigs?.some((provider) => provider.state === "ENABLED" && !!provider.totpProviderConfig) ?? false }));
} catch (error) {
  console.error("Firebase MFA configuration check/update failed. Enable Authentication with Identity Platform and check operator permissions.");
  console.error("Error code:", typeof error?.code === "string" ? error.code : "unavailable");
  process.exitCode = 1;
}
