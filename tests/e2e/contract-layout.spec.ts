import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/contractPdfHarness.ts");
type ContractFixture = Window & { contractPdfFixture(long: boolean): Promise<{pdf:string;html:string;filename:string}>; invoicePdfFixture(): Promise<string> };
const textHash = (pdf: string) => createHash("sha256").update(
  [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match => match[1])
    .filter(value => !["AYURSARGA", "PARTNER CENTRE AGREEMENT", "PRIVATE & CONFIDENTIAL", "Ayursarga Partner Network"].includes(value) && !/^Page \d+$/.test(value))
    .join("").replace(/\s/g, ""),
).digest("hex");

for (const [long, baselineHash] of [
  [false, "51410a442d90fefb1770c6e7476b7593fd692c1ce99bd42a9cf1d5fa09133275"],
  [true, "2d97dc0c025cddb2a48a51a83a753de4b13042359a9b0be03d586d590fea24fe"],
] as const) {
  test(`partner contract stays five pages with unchanged exported text (${long ? "long" : "standard"} particulars)`, async ({page}) => {
    await page.setContent("<html></html>");
    await page.addScriptTag({content:bundle});
    const result = await page.evaluate(long => (window as unknown as ContractFixture).contractPdfFixture(long), long);
    expect(result.pdf).toMatch(/\/Count 5\b/);
    expect(textHash(result.pdf)).toBe(baselineHash);
    expect(result.pdf).toContain("/F1 9.1 Tf");
    const streams = [...result.pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => match[1]);
    expect(streams).toHaveLength(5);
    for (const [index, stream] of streams.entries()) {
      expect(stream).toContain(`(Page ${index + 1}) Tj`);
      expect(stream).toContain("(PRIVATE & CONFIDENTIAL) Tj");
      // All text remains on the A4 sheet, clear of the page's physical edges.
      for (const position of stream.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) {
        expect(Number(position[1])).toBeGreaterThanOrEqual(48);
        expect(Number(position[1])).toBeLessThan(595 - 48);
        expect(Number(position[2])).toBeGreaterThanOrEqual(13);
        expect(Number(position[2])).toBeLessThanOrEqual(842 - 30);
      }
    }
    expect(streams[4]).toContain("For Ayursarga");
    expect(streams[4]).toContain("For the Partner Centre");
    expect(streams[4].match(/\(SIGNATURE\) Tj/g)).toHaveLength(2);
    expect(result.html).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(result.filename).toMatch(/^aspc-.*-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
}

test("contract compaction leaves shared invoice PDF rendering byte-for-byte unchanged", async ({page}) => {
  await page.setContent("<html></html>");
  await page.addScriptTag({content:bundle});
  const pdf = await page.evaluate(() => (window as unknown as ContractFixture).invoicePdfFixture());
  expect(createHash("sha256").update(pdf).digest("hex")).toBe("533a9b53cb108afaab50014bf3acb284fef8b5d7fa2879f45321e075b3494fc8");
});

test("compact HTML preview retains readable body text and equal unclipped signature boxes", async ({page}, info) => {
  await page.setContent("<html></html>");
  await page.addScriptTag({content:bundle});
  const {html} = await page.evaluate(() => (window as unknown as ContractFixture).contractPdfFixture(true));
  await page.route("https://contract.test/**", route => {
    const name = new URL(route.request().url()).pathname;
    return name === "/mainlogo.png" || name === "/harisesign.png"
      ? route.fulfill({contentType:"image/png",body:readFileSync(`public${name}`)}) : route.abort();
  });
  await page.setContent(html.replace("<head>", '<head><base href="https://contract.test/">'));
  expect(await page.locator("body").evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(10.25 * 96 / 72, 2);
  const boxes = page.locator(".signature-mark");
  await expect(boxes).toHaveCount(2);
  const first = (await boxes.nth(0).boundingBox())!, second = (await boxes.nth(1).boundingBox())!;
  expect(first.height).toBeCloseTo(second.height, 1);
  // The second cell has the existing 1px centre-divider border.
  expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
  for (const box of await boxes.all()) expect(await box.evaluate(node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth)).toBe(true);
  await expect(page.locator(".signature-date")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".party-details").screenshot({path:info.outputPath("compact-particulars.png")});
  await page.locator(".signature-boxes").screenshot({path:info.outputPath("compact-signatures.png")});
});
