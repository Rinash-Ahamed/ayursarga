import { isIsoDate, toDateInputValue } from "@/utils/date";
import { AYURSARGA_GSTIN, AYURSARGA_REGISTERED_OFFICE_PIN } from "@/features/hospitals/ayursargaCompanyDetails";

export type InvoiceTaxMode = "cgst-sgst" | "igst" | "none";
export type InvoiceInput = {
  hospitalId: string; invoiceDate: string; dueDate: string; description: string;
  commissionAmount: string; gstRate: string; taxMode: InvoiceTaxMode;
  placeOfSupply: string; sac: string; notes: string;
};
export type InvoiceParty = { name: string; address: string; gstin: string; email: string; state: string };
export type CommissionInvoice = InvoiceInput & {
  id: string; invoiceNumber: string; status: "issued"; issuer: InvoiceParty; billTo: InvoiceParty;
  taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number;
};
export const INVOICE_ISSUER: InvoiceParty = {
  name: "AYURSARGA PVT LTD", gstin: AYURSARGA_GSTIN, email: "info@ayursarga.com", state: "Kerala",
  address: `5/1957 KUZHALMANNAM ROAD, KODUVAYUR, PALAKKAD, KERALA ${AYURSARGA_REGISTERED_OFFICE_PIN}, INDIA`,
};

function decimalHundredths(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function validateInvoiceInput(raw: Record<string, unknown>) {
  const text = (key: string) => typeof raw[key] === "string" ? raw[key].trim() : "";
  const data: InvoiceInput = {
    hospitalId: text("hospitalId"), invoiceDate: text("invoiceDate"), dueDate: text("dueDate"),
    description: text("description"), commissionAmount: text("commissionAmount"), gstRate: text("gstRate"),
    taxMode: text("taxMode") as InvoiceTaxMode, placeOfSupply: text("placeOfSupply"), sac: text("sac"), notes: text("notes"),
  };
  const errors: Partial<Record<keyof InvoiceInput, string>> = {};
  if (!data.hospitalId || data.hospitalId.length > 160 || data.hospitalId.includes("/")) errors.hospitalId = "Select a hospital.";
  if (!isIsoDate(data.invoiceDate)) errors.invoiceDate = "Enter a valid invoice date.";
  if (data.dueDate && (!isIsoDate(data.dueDate) || data.dueDate < data.invoiceDate)) errors.dueDate = "Due date must be on or after the invoice date.";
  if (data.description.length < 3 || data.description.length > 500) errors.description = "Enter a commission description of 3 to 500 characters.";
  if (data.placeOfSupply.length < 2 || data.placeOfSupply.length > 100) errors.placeOfSupply = "Enter the place of supply.";
  if (data.sac && !/^\d{4,8}$/.test(data.sac)) errors.sac = "Enter a 4 to 8 digit SAC, or leave it blank.";
  if (data.notes.length > 1000) errors.notes = "Keep notes within 1,000 characters.";
  const taxablePaise = decimalHundredths(data.commissionAmount);
  if (taxablePaise == null || taxablePaise <= 0) errors.commissionAmount = "Enter a positive commission amount with up to 2 decimal places.";
  const rate = decimalHundredths(data.gstRate);
  if (rate == null || rate > 10000) errors.gstRate = "Enter a GST rate from 0 to 100, with up to 2 decimal places.";
  if (!["cgst-sgst", "igst", "none"].includes(data.taxMode)) errors.taxMode = "Select a tax treatment.";
  if (data.taxMode === "none" && rate !== 0) errors.gstRate = "Use a 0% rate when no GST is selected.";
  const base = taxablePaise ?? 0;
  const cgstPaise = data.taxMode === "cgst-sgst" ? Math.round(base * (rate ?? 0) / 20000) : 0;
  const sgstPaise = cgstPaise;
  const igstPaise = data.taxMode === "igst" ? Math.round(base * (rate ?? 0) / 10000) : 0;
  return { data, errors, isValid: Object.keys(errors).length === 0,
    totals: { taxablePaise: base, cgstPaise, sgstPaise, igstPaise, totalPaise: base + cgstPaise + sgstPaise + igstPaise } };
}

export function invoiceParty(hospital: Record<string, unknown>): InvoiceParty {
  const text = (key: string) => typeof hospital[key] === "string" ? hospital[key].trim() : "";
  return { name: text("legalName") || text("name"), address: text("registeredAddress") || text("address"),
    gstin: text("gstin"), email: text("email"), state: text("state") };
}

export function emptyInvoiceInput(): InvoiceInput {
  return { hospitalId: "", invoiceDate: toDateInputValue(), dueDate: "", description: "Hospital commission",
    commissionAmount: "", gstRate: "", taxMode: "cgst-sgst", placeOfSupply: "", sac: "", notes: "" };
}
