import { isValidEmail, toTrimmedString } from "@/utils/text";
import { isIndiaStateOrUnionTerritory } from "@/constants/indiaStates";
import { isDistrictInIndiaState } from "@/constants/indiaDistricts";

export type HospitalFields = {
  name: string;
  email: string;
  phone: string;
  hospitalPhone1: string;
  hospitalPhone2: string | null;
  address: string;
  city: string;
  district: string;
  state: string;
  description: string;
  imageUrl: string | null;
  commissionPercentage: number;
};

export type HospitalField = keyof HospitalFields;
export type HospitalValidationErrors = Partial<Record<HospitalField, string>>;

const PHONE_PATTERN = /^[+()\d\s-]{7,25}$/;

function optionalWebUrl(value: unknown) {
  const url = toTrimmedString(value, 500);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function validateHospitalFields(input: Record<string, unknown>) {
  const name = toTrimmedString(input.name, 120);
  const email = toTrimmedString(input.email, 160).toLowerCase();
  const phone = toTrimmedString(input.phone, 25);
  const hospitalPhone1 = toTrimmedString(input.hospitalPhone1, 25);
  const hospitalPhone2Text = toTrimmedString(input.hospitalPhone2, 25);
  const hospitalPhone2 = hospitalPhone2Text || null;
  const address = toTrimmedString(input.address, 300);
  const city = toTrimmedString(input.city, 80);
  const district = toTrimmedString(input.district, 80);
  const state = toTrimmedString(input.state, 80);
  const description = toTrimmedString(input.description, 2_000);
  const rawImageUrl = toTrimmedString(input.imageUrl, 500);
  const imageUrl = optionalWebUrl(rawImageUrl);
  const commissionPercentage = typeof input.commissionPercentage === "number"
    ? input.commissionPercentage
    : Number(input.commissionPercentage);
  const normalizedCommission = Number.isFinite(commissionPercentage)
    ? Math.round(commissionPercentage * 100) / 100
    : commissionPercentage;
  const errors: HospitalValidationErrors = {};

  if (name.length < 2) errors.name = "Enter a hospital name of at least 2 characters.";
  if (!isValidEmail(email)) errors.email = "Enter a valid official email address.";
  if (!PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid owner WhatsApp number.";
  if (!PHONE_PATTERN.test(hospitalPhone1)) errors.hospitalPhone1 = "Enter a valid primary hospital phone number.";
  if (hospitalPhone2 && !PHONE_PATTERN.test(hospitalPhone2)) errors.hospitalPhone2 = "Enter a valid secondary hospital phone number.";
  if (address.length < 10) errors.address = "Enter the hospital's complete street address.";
  if (city.length < 2) errors.city = "Enter a valid city or locality.";
  if (!isIndiaStateOrUnionTerritory(state)) errors.state = "Select a valid Indian state or union territory.";
  if (!isDistrictInIndiaState(state, district)) errors.district = state ? "Select a district belonging to the selected state." : "Select a state first.";
  if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
    errors.commissionPercentage = "Commission must be between 0 and 100 percent.";
  }
  if (rawImageUrl && !imageUrl) errors.imageUrl = "Enter a complete image URL beginning with http:// or https://.";

  const data: HospitalFields = {
    name, email, phone, hospitalPhone1, hospitalPhone2, address, city, district, state, description, imageUrl, commissionPercentage: normalizedCommission,
  };
  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

export function hospitalFormValues(form: FormData): Record<string, unknown> {
  return {
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    hospitalPhone1: form.get("hospitalPhone1"),
    hospitalPhone2: form.get("hospitalPhone2"),
    address: form.get("address"),
    city: form.get("city"),
    district: form.get("district"),
    state: form.get("state"),
    description: form.get("description"),
    imageUrl: form.get("imageUrl"),
    commissionPercentage: form.get("commission"),
  };
}
