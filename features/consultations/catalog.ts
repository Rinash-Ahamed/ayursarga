/** Explicit Admin assignments, never inferred from a name or designation. */
export const CONSULTATION_SERVICES = [
  { id: "prenatal-doctor", label: "Prenatal doctor consultation" },
  { id: "prenatal-dietitian", label: "Prenatal dietary advice" },
  { id: "prenatal-yoga", label: "Pregnancy yoga" },
  { id: "lactation", label: "Lactation support" },
  { id: "womens-wellness", label: "Women's wellness" },
  { id: "cosmetologist", label: "Cosmetologist consultation" },
  { id: "psychologist", label: "Psychologist consultation" },
] as const;

export type ConsultationServiceId = typeof CONSULTATION_SERVICES[number]["id"];
export function consultationService(value: unknown) {
  return CONSULTATION_SERVICES.find((service) => service.id === value) ?? null;
}
