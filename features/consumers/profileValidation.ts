import { toTrimmedString } from "@/utils/text";

const PHONE_PATTERN = /^[+()\d\s-]{7,25}$/;

export function validateConsumerContact(input: { name: unknown; phone: unknown; address: unknown }) {
  const name = toTrimmedString(input.name, 120);
  const phone = toTrimmedString(input.phone, 25);
  const address = toTrimmedString(input.address, 300);
  const errors: Partial<Record<"name" | "phone" | "address", string>> = {};
  if (name.length < 2) errors.name = "Enter your full name.";
  if (!PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid contact number using 7 to 25 digits or common phone symbols.";
  return { data: { name, phone, address: address || null }, errors, isValid: Object.keys(errors).length === 0 };
}
