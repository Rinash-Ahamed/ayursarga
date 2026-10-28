/** Decimal values become integer paise/basis points before any calculation. */
function decimalUnits(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;
  const units = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return units <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(units) : null;
}

export function parseConsultantCharge(value: unknown) {
  const units = decimalUnits(value);
  if (units === null) return null;
  const charge = units / 100;
  return decimalUnits(charge) === units ? charge : null;
}

export function parseConsultantCommission(value: unknown) {
  const units = decimalUnits(value);
  return units === null || units > 10000 ? null : units / 100;
}

export function getConsultantPricing(charge: unknown, percentage: unknown) {
  const basePaise = decimalUnits(charge);
  const basisPoints = decimalUnits(percentage);
  if (basePaise === null || basisPoints === null || basisPoints > 10000) return null;
  // Commission is added to the base charge and rounded half-up to one paise.
  const commissionPaise = (BigInt(basePaise) * BigInt(basisPoints) + 5000n) / 10000n;
  const totalPaise = BigInt(basePaise) + commissionPaise;
  if (totalPaise > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const totalCharge = Number(totalPaise) / 100;
  if (decimalUnits(totalCharge) !== Number(totalPaise) || parseConsultantCharge(charge) === null) return null;
  return { baseCharge: basePaise / 100, commissionPercentage: basisPoints / 100,
    commissionAmount: Number(commissionPaise) / 100, totalCharge };
}
