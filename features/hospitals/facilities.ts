import { toTrimmedString } from "@/utils/text";

export const HOSPITAL_FACILITY_GROUPS = [
  {
    title: "Most popular facilities",
    options: ["Free Wi-Fi", "Free parking", "Family rooms", "Daily laundry service", "Power backup"],
  },
  {
    title: "Caretaker and key services",
    options: [
      "Caretaker available to assist guests at the property",
      "Daily housekeeping",
      "Multilingual staff",
      "Doctor on call",
    ],
  },
  {
    title: "Room amenities",
    options: [
      "Wardrobe",
      "Air conditioning",
      "Windows and ventilation",
      "Dining table and chairs",
      "Sofa",
      "Family cot",
      "Baby cradle",
    ],
  },
  {
    title: "Bathroom",
    options: ["Geyser / water heater", "Hair dryer", "Free toiletries", "Slippers"],
  },
  {
    title: "Kitchen",
    options: [
      "Basic utensils",
      "Electric kettle",
      "Induction stove",
      "Drinking water",
      "Refrigerator",
    ],
  },
  {
    title: "Safety and security",
    options: ["CCTV", "Security guard", "Security alarm", "Fire extinguisher"],
  },
  {
    title: "Media and technology",
    options: ["TV", "Lift"],
  },
  {
    title: "Outdoor",
    options: ["Garden", "Kids’ play area", "Balcony"],
  },
] as const;

const FACILITY_OPTIONS = HOSPITAL_FACILITY_GROUPS.flatMap(({ options }) => options);
const FACILITY_LOOKUP = new Map(FACILITY_OPTIONS.map((option) => [option.toLocaleLowerCase(), option]));

function facilityLines(value: string | null | undefined) {
  return (value ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function resolveHospitalFacilities(value: string | null | undefined) {
  const selected = new Set<string>();
  const custom: string[] = [];

  for (const item of facilityLines(value)) {
    const standardOption = FACILITY_LOOKUP.get(item.toLocaleLowerCase());
    if (standardOption) selected.add(standardOption);
    else custom.push(item);
  }

  return { selected, custom: custom.join("\n") };
}

export function hospitalFacilitiesFormValue(form: FormData) {
  const selectedValues = new Set(
    form.getAll("facilityOption").map((value) => String(value).trim()).filter(Boolean),
  );
  const rawCustom = String(form.get("customFacilities") ?? "").trim();
  const customValues = facilityLines(rawCustom);
  const facilities = [
    ...FACILITY_OPTIONS.filter((option) => selectedValues.has(option)),
    ...customValues,
  ].filter((option, index, values) =>
    values.findIndex((value) => value.toLocaleLowerCase() === option.toLocaleLowerCase()) === index
  ).join("\n");

  return {
    facilities: toTrimmedString(facilities, 4_000),
    error: rawCustom.length > 4_000 || facilities.length > 4_000
      ? "Facilities must be 4,000 characters or fewer."
      : null,
  };
}
