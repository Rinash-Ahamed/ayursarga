import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

// Exercise the actual provider's role gate and actual idle hook without
// Firebase sign-in, network requests, or real waiting.
function provider(role, status = "authenticated", hasUser = true) {
  let index = 0, gate, expired, warningEnabled, logouts = 0;
  const states = [{ user: hasUser ? { uid: "fixture" } : null, profile: role ? { role } : null }, status, false, null, false];
  const authService = { logout: async () => { logouts++; } };
  const { AuthProvider } = loadTypeScript("contexts/AuthContext.tsx", {
    react: {
      createContext: () => ({ Provider: "fixture-provider" }),
      useState: () => [states[index++], () => {}],
      useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
    },
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "@/services/auth/authService": { authService },
    "@/hooks/useSessionIdleTimeout": { useSessionIdleTimeout: (enabled, callback, _warning, showWarning) => { gate = enabled; expired = callback; warningEnabled = showWarning; return () => true; } },
  });
  const element = AuthProvider({ children: null });
  return { gate, expired, warningEnabled, value: element.props.value, logouts: () => logouts };
}

for (const role of ["consumer", "admin", "hospital"]) {
  test(`${role} inactivity follows the role-specific session policy`, async t => {
    const session = provider(role);
    assert.equal(session.gate, role !== "consumer");
    assert.equal(session.warningEnabled, role === "admin");
    const cleanups = [];
    const { useSessionIdleTimeout } = loadTypeScript("hooks/useSessionIdleTimeout.ts", {
      react: { useCallback: fn => fn, useRef: value => ({ current: value }), useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } },
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

function TimerFixture(t) {
  const cleanups=[],warnings=[];let logouts=0;
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  globalThis.window=new EventTarget();globalThis.document=Object.assign(new EventTarget(),{visibilityState:'visible'});
  t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
  const {useSessionIdleTimeout}=loadTypeScript('hooks/useSessionIdleTimeout.ts',{
    react:{useCallback:fn=>fn,useRef:value=>({current:value}),useEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);}},
  });
  const resume=useSessionIdleTimeout(true,()=>{logouts++;},open=>warnings.push(open),true);
  t.after(()=>{cleanups.forEach(fn=>fn());t.mock.timers.reset();
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
  return {resume,warnings,logouts:()=>logouts,cleanup:()=>cleanups.forEach(fn=>fn())};
}

test('Admin warning starts exactly two minutes before the unchanged 15-minute deadline, and passive activity cannot dismiss it',t=>{
  const f=TimerFixture(t);t.mock.timers.tick(13*60*1000-1);assert.deepEqual(f.warnings,[]);
  t.mock.timers.tick(1);assert.deepEqual(f.warnings,[true]);
  globalThis.window.dispatchEvent(new Event('pointermove'));globalThis.window.dispatchEvent(new Event('focus'));
  t.mock.timers.tick(2*60*1000);assert.equal(f.logouts(),1);assert.deepEqual(f.warnings,[true,false]);
  assert.equal(f.resume(),false);t.mock.timers.tick(60*60*1000);assert.equal(f.logouts(),1);
});

test('explicit stay signed in resets the existing deadline, and cleanup removes warning/expiry callbacks',t=>{
  const f=TimerFixture(t);t.mock.timers.tick(13*60*1000);assert.equal(f.resume(),true);
  assert.deepEqual(f.warnings,[true,false]);t.mock.timers.tick(13*60*1000-1);assert.equal(f.logouts(),0);
  assert.equal(f.warnings.at(-1),false);t.mock.timers.tick(1);assert.equal(f.warnings.at(-1),true);
  f.cleanup();t.mock.timers.tick(60*60*1000);assert.equal(f.logouts(),0);assert.equal(f.resume(),false);
});

test('an overdue suspended tab cannot resume its session before delayed timers run',t=>{
  const f=TimerFixture(t);t.mock.timers.setTime(15*60*1000+1);
  assert.equal(f.resume(),false);assert.equal(f.logouts(),1);
});
