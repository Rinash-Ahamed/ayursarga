import { isValidEmail, toTrimmedString } from "@/utils/text";

export type HospitalFields = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
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
  const address = toTrimmedString(input.address, 300);
  const city = toTrimmedString(input.city, 80);
  const state = toTrimmedString(input.state, 80);
  const description = toTrimmedString(input.description, 2_000);
  const rawImageUrl = toTrimmedString(input.imageUrl, 500);
  const imageUrl = optionalWebUrl(rawImageUrl);
  const commissionPercentage = typeof input.commissionPercentage === "number"
    ? input.commissionPercentage
    : Number(input.commissionPercentage);
  const errors: HospitalValidationErrors = {};

  if (name.length < 2) errors.name = "Enter a hospital name of at least 2 characters.";
  if (!isValidEmail(email)) errors.email = "Enter a valid official email address.";
  if (!PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid phone number using 7 to 25 digits or common phone symbols.";
  if (address.length < 10) errors.address = "Enter the hospital's complete street address.";
  if (city.length < 2) errors.city = "Enter a valid city or locality.";
  if (state.length < 2) errors.state = "Enter a valid state.";
  if (description && description.length < 20) errors.description = "Either leave the description empty or provide at least 20 characters.";
  if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
    errors.commissionPercentage = "Commission must be between 0 and 100 percent.";
  }
  if (rawImageUrl && !imageUrl) errors.imageUrl = "Enter a complete image URL beginning with http:// or https://.";

  const data: HospitalFields = {
    name, email, phone, address, city, state, description, imageUrl, commissionPercentage,
  };
  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

export function hospitalFormValues(form: FormData): Record<string, unknown> {
  return {
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    address: form.get("address"),
    city: form.get("city"),
    state: form.get("state"),
    description: form.get("description"),
    imageUrl: form.get("imageUrl"),
    commissionPercentage: form.get("commission"),
  };
}
