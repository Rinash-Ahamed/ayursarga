import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { buildHospitalContractHtml } from "@/features/hospitals/partnerContractTemplate";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_TOP = 92;
const CONTENT_BOTTOM = 772;
const FOREST = "0.09 0.24 0.17";
const EMERALD = "0.06 0.34 0.22";
const GOLD = "0.72 0.53 0.18";
const INK = "0.15 0.16 0.13";
const MUTED = "0.40 0.45 0.39";
const LINE = "0.84 0.87 0.84";

type PdfBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; rows: string[][]; signature: boolean };

function safePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/₹/g, "Rs. ")
    .replace(/[^\x20-\x7E]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapText(value: string, maximumCharacters: number) {
  const lines: string[] = [];
  for (const paragraph of safePdfText(value).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maximumCharacters || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (!words.length) lines.push("");
  }
  return lines;
}

function textLine(value: unknown, x: number, top: number, size = 10, font = "F1", color = INK) {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${PAGE_HEIGHT - top} Tm (${safePdfText(value)}) Tj ET`;
}

function rectangle(x: number, top: number, width: number, height: number, fill: string) {
  return `${fill} rg ${x} ${PAGE_HEIGHT - top - height} ${width} ${height} re f`;
}

function border(x: number, top: number, width: number, height: number, color = LINE) {
  return `${color} RG 0.7 w ${x} ${PAGE_HEIGHT - top - height} ${width} ${height} re S`;
}

function nodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLElement && node.tagName === "BR") return "\n";
  return [...node.childNodes].map(nodeText).join("");
}

function contractBlocks(html: string): PdfBlock[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const main = document.querySelector(".contract-document");
  if (!main) throw new Error("The contract template could not be prepared.");
  const blocks: PdfBlock[] = [];
  for (const element of [...main.children]) {
    if (element.tagName === "HEADER") continue;
    if (element.tagName === "H1" || element.tagName === "H2" || element.tagName === "H3") {
      blocks.push({ kind: "heading", level: Number(element.tagName.slice(1)) as 1 | 2 | 3, text: nodeText(element).trim() });
    } else if (element.tagName === "P") {
      blocks.push({ kind: "paragraph", text: nodeText(element).trim() });
    } else if (element.tagName === "TABLE") {
      const rows = [...element.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => nodeText(cell).trim()));
      blocks.push({ kind: "table", rows, signature: element.classList.contains("signature-boxes") });
    }
  }
  return blocks;
}

function pageHeader(pageNumber: number) {
  return [
    rectangle(0, 0, PAGE_WIDTH, 68, FOREST),
    rectangle(0, 68, PAGE_WIDTH, 4, GOLD),
    textLine("AYURSARGA", MARGIN_X, 43, 12, "F2", GOLD),
    textLine("PARTNER CENTRE AGREEMENT", PAGE_WIDTH - 190, 43, 8, "F2", "0.88 0.92 0.89"),
    rectangle(0, 790, PAGE_WIDTH, 52, FOREST),
    rectangle(0, 790, PAGE_WIDTH, 3, GOLD),
    textLine("PRIVATE & CONFIDENTIAL", MARGIN_X, 817, 7.2, "F2", GOLD),
    textLine("Ayursarga Partner Network", MARGIN_X + 112, 817, 7.2, "F1", "0.88 0.92 0.89"),
    textLine(`Page ${pageNumber}`, PAGE_WIDTH - 82, 817, 7.2, "F1", "0.88 0.92 0.89"),
  ];
}

function renderContract(blocks: PdfBlock[]) {
  const pages: string[][] = [];
  let commands: string[] = [];
  let top = CONTENT_TOP;

  function newPage() {
    commands = pageHeader(pages.length + 1);
    pages.push(commands);
    top = CONTENT_TOP;
  }

  function ensureSpace(height: number) {
    if (top + height > CONTENT_BOTTOM) newPage();
  }

  function renderLines(lines: string[], x: number, width: number, size: number, lineHeight: number, font = "F1", color = INK) {
    const maximumCharacters = Math.max(18, Math.floor(width / (size * .52)));
    const wrapped = lines.flatMap((line) => wrapText(line, maximumCharacters));
    for (const line of wrapped) {
      ensureSpace(lineHeight + 2);
      commands.push(textLine(line, x, top, size, font, color));
      top += lineHeight;
    }
  }

  newPage();
  for (const block of blocks) {
    if (block.kind === "heading") {
      const size = block.level === 1 ? 23 : block.level === 2 ? 15 : 11;
      const lineHeight = block.level === 1 ? 28 : block.level === 2 ? 20 : 16;
      const gapBefore = block.level === 1 ? 2 : block.level === 2 ? 15 : 10;
      const lines = wrapText(block.text, Math.floor(CONTENT_WIDTH / (size * .52)));
      ensureSpace(gapBefore + lines.length * lineHeight + 12);
      top += gapBefore;
      if (block.level === 2) commands.push(rectangle(MARGIN_X, top - 12, 4, lines.length * lineHeight + 9, GOLD));
      lines.forEach((line) => {
        commands.push(textLine(line, MARGIN_X + (block.level === 2 ? 12 : 0), top, size, "F2", block.level === 3 ? EMERALD : FOREST));
        top += lineHeight;
      });
      top += block.level === 1 ? 10 : 7;
      continue;
    }

    if (block.kind === "paragraph") {
      renderLines(block.text.split("\n"), MARGIN_X, CONTENT_WIDTH, 9.1, 13.2);
      top += 8;
      continue;
    }

    if (block.signature) {
      const columnWidth = CONTENT_WIDTH / 2;
      const headerHeight = 30;
      const signingHeight = 96;
      const totalHeight = headerHeight + signingHeight;
      top += 4;
      ensureSpace(totalHeight + 10);
      commands.push(rectangle(MARGIN_X, top, CONTENT_WIDTH, headerHeight, FOREST));
      commands.push(border(MARGIN_X, top, CONTENT_WIDTH, totalHeight, "0.45 0.55 0.48"));
      commands.push(`${LINE} RG 0.7 w ${MARGIN_X + columnWidth} ${PAGE_HEIGHT - top - totalHeight} m ${MARGIN_X + columnWidth} ${PAGE_HEIGHT - top} l S`);
      commands.push(textLine(block.rows[0]?.[0] ?? "For Ayursarga", MARGIN_X + 14, top + 20, 9, "F2", "1 1 1"));
      commands.push(textLine(block.rows[0]?.[1] ?? "For the Partner Centre", MARGIN_X + columnWidth + 14, top + 20, 9, "F2", "1 1 1"));

      for (let column = 0; column < 2; column += 1) {
        const left = MARGIN_X + column * columnWidth;
        const innerLeft = left + 14;
        const innerWidth = columnWidth - 28;
        const cellTop = top + headerHeight;
        commands.push(rectangle(innerLeft, cellTop + 14, innerWidth, 62, "0.97 0.98 0.97"));
        commands.push(border(innerLeft, cellTop + 14, innerWidth, 62));
        commands.push(textLine("SIGNATURE", innerLeft + 10, cellTop + 31, 7.2, "F2", EMERALD));
        commands.push(`${MUTED} RG 0.6 w ${innerLeft + 10} ${PAGE_HEIGHT - cellTop - 65} m ${innerLeft + innerWidth - 10} ${PAGE_HEIGHT - cellTop - 65} l S`);
      }
      top += totalHeight + 10;
      continue;
    }

    const firstColumnWidth = 174;
    const secondColumnWidth = CONTENT_WIDTH - firstColumnWidth;
    top += 4;
    for (const [rowIndex, row] of block.rows.entries()) {
      const firstLines = wrapText(row[0] ?? "", Math.floor((firstColumnWidth - 18) / (8.5 * .52)));
      const secondLines = wrapText(row[1] ?? "", Math.floor((secondColumnWidth - 18) / (8.5 * .52)));
      const rowHeight = Math.max(block.signature && rowIndex > 0 ? 142 : 28, Math.max(firstLines.length, secondLines.length) * 11.5 + 14);
      ensureSpace(rowHeight + 3);
      commands.push(rectangle(MARGIN_X, top, CONTENT_WIDTH, rowHeight, rowIndex === 0 ? FOREST : rowIndex % 2 === 0 ? "0.96 0.97 0.96" : "1 1 1"));
      commands.push(border(MARGIN_X, top, CONTENT_WIDTH, rowHeight));
      commands.push(`${LINE} RG 0.7 w ${MARGIN_X + firstColumnWidth} ${PAGE_HEIGHT - top - rowHeight} m ${MARGIN_X + firstColumnWidth} ${PAGE_HEIGHT - top} l S`);
      const color = rowIndex === 0 ? "1 1 1" : INK;
      const font = rowIndex === 0 ? "F2" : "F1";
      firstLines.forEach((line, index) => commands.push(textLine(line, MARGIN_X + 9, top + 16 + index * 11.5, 8.5, font, color)));
      secondLines.forEach((line, index) => commands.push(textLine(line, MARGIN_X + firstColumnWidth + 9, top + 16 + index * 11.5, 8.5, font, color)));
      top += rowHeight;
    }
    top += 10;
  }
  return pages.map((page) => page.join("\n"));
}

function createPdf(pageContents: string[]) {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pageContents.map((_, index) => 6 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageContents.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>";
  const resources = "<< /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >>";
  pageContents.forEach((content, index) => {
    const pageId = 6 + index * 2;
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let output = "%PDF-1.4\n%AYURSARGA\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = output.length;
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}

export function buildHospitalContractPdf(hospital: DocumentRecord<HospitalDocument>) {
  const html = buildHospitalContractHtml(hospital);
  const pages = renderContract(contractBlocks(html));
  const safeName = hospital.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "hospital";
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => dateParts.find((item) => item.type === type)?.value ?? "";
  const currentDate = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    blob: createPdf(pages),
    filename: `ayursarga-partner-contract-${safeName}-${currentDate}.pdf`,
    html,
  };
}
