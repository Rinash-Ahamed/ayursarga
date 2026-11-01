export const CONSULTANT_TITLES = ["Dr.", "Mr.", "Ms.", "Mrs."] as const;
export type ConsultantTitle = typeof CONSULTANT_TITLES[number];

export function consultantDisplayName(consultant: { name?: unknown; title?: unknown }): string {
  const name = typeof consultant.name === "string" ? consultant.name.trim().slice(0, 120) : "";
  if (!CONSULTANT_TITLES.includes(consultant.title as ConsultantTitle)) return name;
  return `${consultant.title} ${name.replace(/^(?:Mrs|Dr|Mr|Ms)\.?\s+/i, "")}`.trim();
}
