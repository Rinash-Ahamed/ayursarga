import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const FOREST = "0.12 0.24 0.17";
const GOLD = "0.72 0.53 0.18";
const INK = "0.16 0.15 0.12";
const MUTED = "0.38 0.39 0.34";

export function hospitalContractReference(hospitalId: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `AYU-${day}-${hospitalId.slice(0, 8).toUpperCase()}`;
}

function safePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapText(value: string, maximumCharacters: number) {
  const words = safePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
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
  return lines;
}

function textLine(value: unknown, x: number, top: number, size = 10, font = "F1", color = INK) {
  const y = PAGE_HEIGHT - top;
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${safePdfText(value)}) Tj ET`;
}

function wrappedText(value: string, x: number, top: number, width: number, size = 10, font = "F1", color = INK, lineHeight = 14) {
  const maximumCharacters = Math.max(24, Math.floor(width / (size * .52)));
  const lines = wrapText(value, maximumCharacters);
  return {
    commands: lines.map((line, index) => textLine(line, x, top + index * lineHeight, size, font, color)),
    height: Math.max(lineHeight, lines.length * lineHeight),
  };
}

function pageHeader(reference: string, generatedDate: string, pageNumber: number) {
  return [
    `${FOREST} rg 0 ${PAGE_HEIGHT - 105} ${PAGE_WIDTH} 105 re f`,
    textLine("AYURSARGA", 48, 43, 10, "F2", GOLD),
    textLine("Hospital Partnership Contract", 48, 72, 23, "F2", "1 1 1"),
    textLine(`Reference: ${reference}`, 372, 48, 8.5, "F1", "0.92 0.92 0.89"),
    textLine(`Generated: ${generatedDate}`, 372, 65, 8.5, "F1", "0.92 0.92 0.89"),
    textLine(`Page ${pageNumber} of 2`, 372, 82, 8.5, "F1", "0.92 0.92 0.89"),
  ];
}

function detail(commands: string[], label: string, value: unknown, x: number, top: number, width = 220) {
  commands.push(textLine(label.toUpperCase(), x, top, 7.5, "F2", MUTED));
  commands.push(...wrappedText(String(value ?? ""), x, top + 16, width, 10.5, "F2", INK, 14).commands);
}

function clause(commands: string[], number: number, title: string, body: string, top: number) {
  commands.push(textLine(`${number}. ${title}`, 50, top, 11, "F2", FOREST));
  const paragraph = wrappedText(body, 50, top + 20, 495, 9.5, "F1", INK, 14);
  commands.push(...paragraph.commands);
  return top + 20 + paragraph.height + 17;
}

function createPdf(pageContents: string[]) {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [6 0 R 8 0 R] /Count 2 >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>";
  const resources = "<< /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >>";
  objects[6] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents 7 0 R >>`;
  objects[7] = `<< /Length ${pageContents[0].length} >>\nstream\n${pageContents[0]}\nendstream`;
  objects[8] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents 9 0 R >>`;
  objects[9] = `<< /Length ${pageContents[1].length} >>\nstream\n${pageContents[1]}\nendstream`;

  let output = "%PDF-1.4\n%AYURSARGA\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = output.length;
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}

/** Replace the agreement wording here when the approved contract is supplied. */
export function buildHospitalContractPdf(hospital: DocumentRecord<HospitalDocument>, generatedAt = new Date()) {
  const reference = hospitalContractReference(hospital.id, generatedAt);
  const generatedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(generatedAt);
  const commission = `${Number(hospital.commissionPercentage).toFixed(2)}%`;
  const location = [hospital.city, hospital.district, hospital.state].filter(Boolean).join(", ");
  const firstPage = pageHeader(reference, generatedDate, 1);
  const secondPage = pageHeader(reference, generatedDate, 2);

  firstPage.push(textLine("Hospital details", 50, 137, 16, "F2", FOREST));
  firstPage.push("0.976 0.961 0.918 rg 42 522 511 164 re f");
  detail(firstPage, "Hospital", hospital.name, 58, 174);
  detail(firstPage, "Official email", hospital.email, 310, 174);
  detail(firstPage, "Owner WhatsApp", hospital.phone, 58, 218);
  detail(firstPage, "Hospital phone 1", hospital.hospitalPhone1 || "Not provided", 310, 218);
  detail(firstPage, "Location", location, 58, 262);
  detail(firstPage, "Agreed commission", commission, 310, 262);
  detail(firstPage, "Registered address", hospital.address, 58, 306, 475);

  firstPage.push(textLine("Agreement terms", 50, 370, 16, "F2", FOREST));
  let top = 405;
  top = clause(firstPage, 1, "Partnership", "The Hospital requests participation in the Ayursarga discovery and appointment-request platform, subject to approval and the final agreed commercial terms.", top);
  top = clause(firstPage, 2, "Information", "The Hospital confirms that its profile, services, pricing, licences and contact information supplied to Ayursarga are accurate and may be verified before publication.", top);
  clause(firstPage, 3, "Consumer care", "The Hospital remains solely responsible for clinical assessment, treatment, patient consent, regulatory compliance and care delivered to consumers.", top);

  secondPage.push(textLine("Agreement terms continued", 50, 145, 16, "F2", FOREST));
  let secondTop = 185;
  secondTop = clause(secondPage, 4, "Commercial terms", `The current platform commission is ${commission} unless replaced by a later written agreement signed by both parties.`, secondTop);
  secondTop = clause(secondPage, 5, "Activation", "The hospital profile remains pending and private until both required contracts are confirmed as signed and an Ayursarga administrator activates the profile.", secondTop);
  const note = wrappedText("This is a temporary development template and must be replaced with the approved legal contract before production use.", 50, secondTop + 8, 495, 9.5, "F3", MUTED, 14);
  secondPage.push(...note.commands);

  const signatureTop = 570;
  secondPage.push(`${INK} RG 50 ${PAGE_HEIGHT - signatureTop} 215 0.8 re S`);
  secondPage.push(`${INK} RG 330 ${PAGE_HEIGHT - signatureTop} 215 0.8 re S`);
  secondPage.push(textLine(`For ${hospital.name}`, 50, signatureTop + 18, 10, "F2", FOREST));
  secondPage.push(textLine("Name / Signature / Date", 50, signatureTop + 36, 8.5, "F1", MUTED));
  secondPage.push(textLine("For Ayursarga", 330, signatureTop + 18, 10, "F2", FOREST));
  secondPage.push(textLine("Name / Signature / Date", 330, signatureTop + 36, 8.5, "F1", MUTED));

  const safeName = hospital.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "hospital";
  return {
    blob: createPdf([firstPage.join("\n"), secondPage.join("\n")]),
    filename: `ayursarga-contract-${safeName}-${reference}.pdf`,
  };
}
