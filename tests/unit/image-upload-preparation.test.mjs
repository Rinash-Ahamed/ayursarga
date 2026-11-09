import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import ts from "typescript";
import { chromium, webkit } from "@playwright/test";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("consultant upload sends prepared bytes and actual MIME type while retaining revision protection", async () => {
  const calls = [];
  const prepared = new Blob(["prepared"], { type: "image/png" });
  const service = loadTypeScript("services/consultants/consultantService.ts", {
    "@/utils/prepareImageUpload": { prepareImageUpload: async (file, limit) => { assert.equal(file.size, 7 * 1024 * 1024); assert.equal(limit, 8 * 1024 * 1024); return prepared; } },
    "@/services/api/client": { authorizedApiRequest: async (...args) => { calls.push(args); return { imageUrl: "https://test.invalid/photo" }; }, decodeMutation: () => {} },
  });
  await service.uploadConsultantPhoto("AS001", { type: "image/jpeg", size: 7 * 1024 * 1024 }, "old-photo");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].body, prepared);
  assert.equal(calls[0][1].headers["Content-Type"], "image/png");
  assert.equal(calls[0][1].headers["X-Expected-Image-Url"], "old-photo");
  await assert.rejects(service.uploadConsultantPhoto("AS001", { type: "image/jpeg", size: 9 * 1024 * 1024 }));
  assert.equal(calls.length, 1);
});

for (const [name, browserType] of [["Chromium", chromium], ["WebKit", webkit]]) {
  test(`IMG-005 ${name}: resizing, forced Safari PNG fallback, oversized fallback and invalid photos`, async () => {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const code = ts.transpileModule(readFileSync("utils/prepareImageUpload.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      const large = await sharp(randomBytes(2048 * 1200 * 3), { raw: { width: 2048, height: 1200, channels: 3 } }).png().toBuffer();
      assert.ok(large.length > 4.5 * 1024 * 1024);
      const small = await sharp({ create: { width: 320, height: 240, channels: 3, background: "green" } }).png().toBuffer();
      const result = await page.evaluate(async ({ code, large, small }) => {
        const compiled = { exports: {} };
        new Function("module", "exports", code)(compiled, compiled.exports);
        const prepare = compiled.exports.prepareImageUpload;
        const photo = (base64) => new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], "photo.png", { type: "image/png" });
        const inspect = async (file) => {
          const blob = await prepare(file, 8 * 1024 * 1024);
          const url = URL.createObjectURL(blob);
          try { const image = new Image(); image.src = url; await image.decode(); return { size: blob.size, type: blob.type, width: image.naturalWidth, height: image.naturalHeight }; }
          finally { URL.revokeObjectURL(url); }
        };
        let rejected = false;
        try { await prepare(new File(["not a photo"], "bad.png", { type: "image/png" }), 8 * 1024 * 1024); } catch { rejected = true; }
        const result = { large: await inspect(photo(large)), small: await inspect(photo(small)), rejected };
        const original = HTMLCanvasElement.prototype.toBlob;
        let fallback, oversizedRejected = false;
        try {
          HTMLCanvasElement.prototype.toBlob = function(callback) { original.call(this, callback, "image/png"); };
          fallback = await inspect(photo(small));
          HTMLCanvasElement.prototype.toBlob = function(callback) { callback(new Blob([new Uint8Array(4 * 1024 * 1024)], { type: "image/png" })); };
          try { await prepare(photo(small), 8 * 1024 * 1024); } catch { oversizedRejected = true; }
        } finally { HTMLCanvasElement.prototype.toBlob = original; }
        return { ...result, fallback, oversizedRejected };
      }, { code, large: large.toString("base64"), small: small.toString("base64") });
      assert.ok(result.large.size > 0 && result.large.size <= 3 * 1024 * 1024);
      assert.ok(["image/webp", "image/png"].includes(result.large.type));
      assert.deepEqual([result.large.width, result.large.height], [1600, 938]);
      assert.deepEqual([result.small.width, result.small.height], [320, 240]);
      assert.equal(result.rejected, true);
      assert.equal(result.fallback.type, "image/png");
      assert.deepEqual([result.fallback.width,result.fallback.height],[320,240]);
      assert.equal(result.oversizedRejected,true);
    } finally { await browser.close(); }
  });
}
