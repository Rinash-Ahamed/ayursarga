import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

test("only AYU_ONLINE=true enables the same public server/client build flag", async () => {
  const previous = process.env.AYU_ONLINE;
  try {
    let index = 0;
    for (const [value, expected] of [["true", "true"], ["false", "false"], [undefined, "false"], ["1", "false"], ["invalid", "false"]]) {
      if (value === undefined) delete process.env.AYU_ONLINE;
      else process.env.AYU_ONLINE = value;
      const { default: config } = await import(`${pathToFileURL(path.resolve("next.config.mjs")).href}?ayu-test=${index++}`);
      assert.equal(config.env.NEXT_PUBLIC_AYU_ONLINE, expected);
    }
  } finally {
    if (previous === undefined) delete process.env.AYU_ONLINE;
    else process.env.AYU_ONLINE = previous;
  }
});

test("the lightweight flag gate defers the complete dialog and example configuration documents restart requirements", () => {
  const launcher = readFileSync("components/AyuBuddy.tsx", "utf8");
  assert.match(launcher, /process\.env\.NEXT_PUBLIC_AYU_ONLINE === "true"/);
  assert.match(launcher, /dynamic\(\(\) => import\("@\/components\/AyuBuddyDialog"\)/);
  assert.doesNotMatch(launcher, /import .*from "@\/components\/(ModalLayer|AyuBuddyPanel)"/);
  const example = readFileSync(".env.example", "utf8");
  assert.match(example, /^AYU_ONLINE=true$/m);
  assert.match(example, /restart local dev; rebuild\/redeploy/);
});
