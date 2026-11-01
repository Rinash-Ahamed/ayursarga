import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

// Exercise the actual provider's role gate and actual idle hook without
// Firebase sign-in, network requests, or real waiting.
function provider(role, status = "authenticated", hasUser = true) {
  let index = 0, gate, expired, logouts = 0;
  const states = [{ user: hasUser ? { uid: "fixture" } : null, profile: role ? { role } : null }, status, false, null];
  const authService = { logout: async () => { logouts++; } };
  const { AuthProvider } = loadTypeScript("contexts/AuthContext.tsx", {
    react: {
      createContext: () => ({ Provider: "fixture-provider" }),
      useState: () => [states[index++], () => {}],
      useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
    },
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "@/services/auth/authService": { authService },
    "@/hooks/useSessionIdleTimeout": { useSessionIdleTimeout: (enabled, callback) => { gate = enabled; expired = callback; } },
  });
  const element = AuthProvider({ children: null });
  return { gate, expired, value: element.props.value, logouts: () => logouts };
}

for (const role of ["consumer", "admin", "hospital"]) {
  test(`${role} inactivity follows the role-specific session policy`, async t => {
    const session = provider(role);
    assert.equal(session.gate, role !== "consumer");
    const cleanups = [];
    const { useSessionIdleTimeout } = loadTypeScript("hooks/useSessionIdleTimeout.ts", {
      react: { useRef: value => ({ current: value }), useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } },
    });
    const priorWindow = globalThis.window, priorDocument = globalThis.document;
    globalThis.window = new EventTarget();
    globalThis.document = Object.assign(new EventTarget(), { visibilityState: "visible" });
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    try {
      useSessionIdleTimeout(session.gate, session.expired);
      t.mock.timers.tick(15 * 60 * 1000 - 1);
      assert.equal(session.logouts(), 0);
      t.mock.timers.tick(1);
      await Promise.resolve();
      assert.equal(session.logouts(), role === "consumer" ? 0 : 1);
      t.mock.timers.tick(24 * 60 * 60 * 1000);
      globalThis.window.dispatchEvent(new Event("focus"));
      globalThis.document.dispatchEvent(new Event("visibilitychange"));
      assert.equal(session.logouts(), role === "consumer" ? 0 : 1);
      if (role === "consumer") {
        await session.value.logout();
        assert.equal(session.logouts(), 1, "explicit Consumer logout must still work");
      }
    } finally {
      cleanups.forEach(cleanup => cleanup());
      t.mock.timers.reset();
      if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
      if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    }
  });
}

test("loading, signed-out and incomplete sessions never start a privileged idle timer", () => {
  assert.equal(provider("admin", "loading").gate, false);
  assert.equal(provider("hospital", "unauthenticated").gate, false);
  assert.equal(provider("admin", "authenticated", false).gate, false);
  assert.equal(provider(null).gate, false);
});
