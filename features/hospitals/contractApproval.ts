/** Only particulars printed in the agreement participate in approval binding.
 * Keep this pure so the preview and verified server endpoints share one format. */
const CONTRACT_FIELDS = [
  "legalName", "name", "registeredAddress", "address", "email", "phone", "hospitalPhone1", "hospitalPhone2",
  "registrationNumber", "cinNumber", "panNumber", "gstin", "contractEffectiveDate", "contractExpiryDate",
  "emergencyContact", "emergencyReferralHospital", "commissionPercentage",
] as const;

/** Signing and activation must accept exactly the same stored contract URLs. */
export function validContractUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function hospitalContractContent(hospital: Record<string, unknown>) {
  return JSON.stringify({ version: 1, ...Object.fromEntries(CONTRACT_FIELDS.map(field => {
    const value = field === "legalName" ? hospital.legalName || hospital.name
      : field === "registeredAddress" ? hospital.registeredAddress || hospital.address : hospital[field];
    return [field, field === "commissionPercentage" ? Number(value).toFixed(2) : String(value ?? "").trim()];
  })) });
}

/** Untouched legacy approvals remain valid; pending edits explicitly invalidate
 * them. New approvals must match both generated and signed content. */
export function hasCurrentHospitalContract(hospital: Record<string, unknown>) {
  if (hospital.contractNeedsRegeneration === true || hospital.contractStatus !== "signed") return false;
  if (hospital.contractGeneratedContent == null && hospital.contractSignedContent == null) return true;
  return hospital.contractGeneratedContent === hospitalContractContent(hospital)
    && hospital.contractSignedContent === hospital.contractGeneratedContent;
}

/** Append-only server history preserves previous agreements independently of
 * the separately clearable audit log. Never include gallery or clinical data. */
export function hospitalContractRevision(hospital: Record<string, unknown>) {
  const keys = ["contractStatus", "contractGeneratedAt", "contractGeneratedBy", "contractSignedAt", "contractSignedBy", "contractUrl",
    "contractGeneratedContent", "contractSignedContent", "contractNeedsRegeneration"];
  return { particulars: JSON.parse(hospitalContractContent(hospital)) as Record<string, string | number>,
    ...Object.fromEntries(keys.map(key => [key, hospital[key] ?? null])) };
}
