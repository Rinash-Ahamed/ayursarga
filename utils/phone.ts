export const PHONE_NUMBER_LENGTH = 10;
export const PHONE_NUMBER_PATTERN = /^\d{10}$/;

export function sanitizePhoneNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > PHONE_NUMBER_LENGTH && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, PHONE_NUMBER_LENGTH);
}

export function isValidPhoneNumber(value: string) {
  return PHONE_NUMBER_PATTERN.test(value);
}
