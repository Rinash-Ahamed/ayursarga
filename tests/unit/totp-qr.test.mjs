import { test } from "node:test";
import assert from "node:assert/strict";
import qrcode from "qrcode-generator";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { buildTotpQr } = loadTypeScript("features/auth/totpQr.ts");
const uri = "otpauth://totp/Ayursarga:admin%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Ayursarga";

test("local SVG preserves every encoded module with a four-module white quiet zone", () => {
  const encoded = buildTotpQr(uri);
  const qr = qrcode(0, "M"); qr.addData(new URL(uri).href, "Byte"); qr.make();
  assert.equal(encoded.size, qr.getModuleCount() + 8);
  const modules = new Set();
  const runs = [...encoded.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
  assert.equal(runs.map(run => run[0]).join(""), encoded.path);
  for (const [, x, y, length, reverse] of runs) {
    assert.equal(length, reverse);
    assert.ok(+x >= 4 && +y >= 4 && +x + +length <= encoded.size - 4 && +y < encoded.size - 4);
    for (let dx = 0; dx < +length; dx++) modules.add(`${+y - 4},${+x - 4 + dx}`);
  }
  for (let y = 0; y < qr.getModuleCount(); y++) for (let x = 0; x < qr.getModuleCount(); x++) {
    assert.equal(modules.has(`${y},${x}`), qr.isDark(y, x));
  }
  assert.deepEqual(buildTotpQr(uri), encoded);
});

test("QR rejects invalid, remote, non-TOTP, missing-secret and oversized input", () => {
  for (const value of [undefined, "invalid", "https://example.test/?secret=private", "otpauth://hotp/test?secret=private", "otpauth://totp/test", uri + "x".repeat(2048)]) {
    assert.throws(() => buildTotpQr(value));
  }
});
