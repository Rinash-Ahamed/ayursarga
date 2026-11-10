import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/contractPdfHarness.ts");
type ContractFixture = Window & { contractPdfFixture(long: boolean): Promise<{pdf:string;html:string;filename:string}>; invoicePdfFixture(): Promise<string> };
const exportedText = (pdf: string) =>
  [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match => match[1])
    .filter(value => !["AYURSARGA", "PARTNER CENTRE AGREEMENT", "PRIVATE & CONFIDENTIAL", "Ayursarga Partner Network"].includes(value) && !/^Page \d+$/.test(value))
    .map(value => value.replace(/\\([\\()])/g, "$1")).join("");
const comparableText = (text: string) => text.normalize("NFKD").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7e]/g, "").replace(/\s/g, "").toLowerCase();

test('CON-010: PDF filename uses current India date even while browser is on previous UTC day',async({page})=>{
  await page.clock.install({time:new Date('2026-11-08T20:00:00Z')});
  await page.setContent('<html></html>');await page.addScriptTag({content:bundle});
  const result=await page.evaluate(()=>(window as unknown as ContractFixture).contractPdfFixture(false));
  expect(result.filename).toBe('aspc-ayursarga-partner-wellness-centre-2026-11-09.pdf');
});

for (const [long, baselineHash] of [
  [false, "65bd3f92a7eb6cdfb50ecdf16aab7572cc08a62fc238a32a7829385b286f133d"],
  [true, "1b024caf24b14f8316108652ff20616d3846afc4f31032d661634c03f2cb9097"],
] as const) {
  test(`partner contract stays five pages with unchanged exported text (${long ? "long" : "standard"} particulars)`, async ({page}) => {
    await page.clock.install({time:new Date("2026-11-10T08:00:00Z")});
    await page.setContent("<html></html>");
    await page.addScriptTag({content:bundle});
    const result = await page.evaluate(long => (window as unknown as ContractFixture).contractPdfFixture(long), long);
    expect(result.pdf).toMatch(/\/Count 5\b/);
    // Baseline taken before this typography task. The entire populated HTML
    // body stays byte-identical; only the stylesheet and export layout change.
    expect(createHash("sha256").update(result.html.split("<body>")[1].split("</body>")[0]).digest("hex")).toBe(baselineHash);
    expect(result.pdf).toContain("/F1 9.5 Tf");
    const expected = await page.evaluate(html => {
      const document = new DOMParser().parseFromString(html, "text/html");
      return [...document.querySelectorAll(".contract-document>p,.contract-document>h2,.contract-document>h3,.contract-document>table:not(.signature-boxes) :is(th,td),.contract-contact-card :is(dt,dd)")].map(node => node.textContent ?? "");
    }, result.html);
    const actual = comparableText(exportedText(result.pdf));
    for (const text of expected) expect(actual, `Export retained: ${text.slice(0, 80)}`).toContain(comparableText(text));
    expect(result.pdf).toContain("(1. Parties and term) Tj");
    expect(result.pdf.match(/\(Date: 10\/11\/2026\) Tj/g)).toHaveLength(2);
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
  for (const selector of ["body", ".contract-brand strong", "h2", "h3", ".contract-footer strong"]) {
    expect(await page.locator(selector).first().evaluate(node => getComputedStyle(node).fontFamily)).toMatch(/Arial/);
  }
  const partyWidths = await page.locator(".party-details th").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  expect(partyWidths[0]).toBeCloseTo(partyWidths[1], 1);
  const typography=async(selector:string)=>page.locator(selector).first().evaluate(node=>{
    const style=getComputedStyle(node);return {size:style.fontSize,font:style.fontFamily,weight:style.fontWeight,lineHeight:style.lineHeight,color:style.color};
  });
  const partyValue=await typography('.party-details td'),contactValue=await typography('.contract-contact-card dd');
  expect(partyValue.size).toBe(contactValue.size);expect(partyValue.font).toBe(contactValue.font);
  expect(partyValue.lineHeight).toBe(contactValue.lineHeight);
  const partyLabel=await typography('.party-details td strong'),contactLabel=await typography('.contract-contact-card dt');
  expect(partyLabel.size).toBe(contactLabel.size);expect(partyLabel.weight).toBe(contactLabel.weight);expect(partyLabel.color).toBe(contactLabel.color);
  expect((await typography('.party-details th')).size).toBe((await typography('.contract-contact-card>strong')).size);
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
