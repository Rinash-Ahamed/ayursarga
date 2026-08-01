const baseUrl = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts";
const email = `consumer-${Date.now()}@example.test`;
const password = "Ayursarga-Test-2026";

async function authRequest(action, body) {
  const response = await fetch(`${baseUrl}:${action}?key=demo-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${action} failed: ${JSON.stringify(payload)}`);
  return payload;
}

const registration = await authRequest("signUp", { email, password, returnSecureToken: true });
if (!registration.localId || registration.email !== email) throw new Error("Registration response is incomplete.");

const login = await authRequest("signInWithPassword", { email, password, returnSecureToken: true });
if (!login.idToken || login.localId !== registration.localId) throw new Error("Login response is incomplete.");

const reset = await authRequest("sendOobCode", { requestType: "PASSWORD_RESET", email });
if (reset.email !== email) throw new Error("Password reset response is incomplete.");

await authRequest("delete", { idToken: login.idToken });
console.log("Firebase Auth emulator: registration, login, reset, and cleanup passed.");
