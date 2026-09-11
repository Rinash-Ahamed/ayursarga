import type { CentreGuidelineId, HospitalDocument } from "@/features/firestore/models";
import { toTrimmedString } from "@/utils/text";

export const DEFAULT_CENTRE_GUIDELINES = [
  {
    id: "visitors",
    title: "Visitors",
    body: "Visitors are permitted only during the centre’s designated visiting hours. Kindly keep visits short.",
  },
  {
    id: "quietEnvironment",
    title: "Maintain a Quiet Environment",
    body: "Please keep conversations, phone calls, music, and other activities quiet to allow mothers and babies adequate rest.",
  },
  {
    id: "foodAndBeverages",
    title: "Food & Beverages",
    body: "Outside food should be brought only with the centre’s permission. Please follow the recommended diet provided by the centre.",
  },
  {
    id: "prohibitedActivities",
    title: "Prohibited Activities",
    body: "Smoking, alcohol, drugs, and any activity that may compromise the safety or comfort of mothers and babies are strictly prohibited.",
  },
  {
    id: "privacyAndPhotography",
    title: "Privacy & Photography",
    body: "Please respect the privacy of other mothers, babies, families, and staff. Photography and video recording require permission.",
  },
  {
    id: "cleanliness",
    title: "Cleanliness",
    body: "Please keep rooms and common areas clean and dispose of waste in the designated bins.",
  },
  {
    id: "propertyDamage",
    title: "Damage to Centre Property",
    body: "Any intentional damage to centre property may be charged to the guest.",
  },
  {
    id: "ayurvedicTherapies",
    title: "Ayurvedic Therapies",
    body: "Ayurvedic treatments and massages will be provided according to the mother’s condition and the package selected. Treatments may be modified or stopped based on medical or clinical assessment.",
  },
  {
    id: "medicationsAndCharges",
    title: "Medications & Additional Charges",
    body: "Medicines or Ayurvedic preparations required in addition to those included in the selected package, based on the doctor’s prescription or clinical assessment, will be charged separately to the mother or family.",
  },
  {
    id: "reportConcerns",
    title: "Report Concerns Immediately",
    body: "Inform the staff immediately about unusual bleeding, fever, severe pain, breathing difficulty, changes in the baby’s condition, or any other concerning symptoms or changes.",
  },
  {
    id: "emergencySituations",
    title: "Emergency Situations",
    body: "In an emergency, the centre may arrange transfer to a nearby hospital or appropriate medical facility. Emergency expenses are the responsibility of the mother or family unless otherwise stated in the package.",
  },
] as const;

export const DEFAULT_CENTRE_GUIDELINE_VALUES: Record<CentreGuidelineId, string> =
  Object.fromEntries(DEFAULT_CENTRE_GUIDELINES.map(({ id, body }) => [id, body])) as Record<CentreGuidelineId, string>;

export function resolveCentreGuidelines(hospital: Pick<HospitalDocument, "centreGuidelines">) {
  return DEFAULT_CENTRE_GUIDELINES.map((guideline) => ({
    ...guideline,
    body: toTrimmedString(hospital.centreGuidelines?.[guideline.id], 1_200) || guideline.body,
  }));
}

export function hospitalGuidelineFormValues(form: FormData) {
  const centreGuidelines = Object.fromEntries(DEFAULT_CENTRE_GUIDELINES.map(({ id, body }) => [
    id,
    toTrimmedString(form.get(`centreGuideline_${id}`), 1_200) || body,
  ])) as Record<CentreGuidelineId, string>;
  const rawAdditionalRules = String(form.get("additionalCentreRules") ?? "").trim();
  const rawFacilities = String(form.get("facilities") ?? "").trim();
  const rawLegalPolicies = String(form.get("legalPolicies") ?? "").trim();
  const additionalCentreRules = toTrimmedString(rawAdditionalRules, 4_000);
  const facilities = toTrimmedString(rawFacilities, 4_000);
  const legalPolicies = toTrimmedString(rawLegalPolicies, 4_000);
  const error = rawAdditionalRules.length > 4_000
    ? "Additional centre rules must be 4,000 characters or fewer."
    : rawFacilities.length > 4_000
      ? "Facilities must be 4,000 characters or fewer."
      : rawLegalPolicies.length > 4_000
        ? "Legal and policy information must be 4,000 characters or fewer."
        : null;

  return { centreGuidelines, additionalCentreRules, facilities, legalPolicies, error };
}
