import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { formatGuidanceProfile, loadGuidanceProfile, saveGuidanceProfile } = loadTypeScript("lib/guidanceProfile.ts");
const profile = { wellnessPath: "Postnatal care", preferences: ["Mother Care", "Baby Care"], district: "Palakkad" };
test("guidance profiles round-trip without requiring budget", () => {
  let stored;
  const previousWindow = globalThis.window;
  globalThis.window = { sessionStorage: { setItem: (_key, value) => { stored = value; }, getItem: () => stored } };
  try {
    saveGuidanceProfile(profile);
    assert.deepEqual(loadGuidanceProfile(), profile);
    assert.equal(Object.hasOwn(JSON.parse(stored), "budget"), false);
    // Previously saved preferences remain readable, but budget is not sent onward.
    stored = JSON.stringify({ ...profile, budget: "Premium stay" });
    assert.equal(loadGuidanceProfile().wellnessPath, "Postnatal care");
    assert.equal(formatGuidanceProfile(loadGuidanceProfile()).includes("Premium stay"), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
test("guidance summaries preserve care details without a budget line", () => {
  const summary = formatGuidanceProfile({ ...profile, expectedDeliveryDate: "2099-10-25" });
  assert.match(summary, /Expected delivery date: 25\/10\/2099/);
  assert.match(summary, /Preferred district: Palakkad/);
  assert.doesNotMatch(summary, /budget|undefined/i);
});
