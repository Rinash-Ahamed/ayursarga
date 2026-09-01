import { toTrimmedString } from "@/utils/text";

const PHONE_PATTERN = /^[+()\d\s-]{7,25}$/;

export function validateConsumerContact(
  input: { name: unknown; phone: unknown; address: unknown; privacyConsent?: unknown },
  requirePrivacyConsent = false,
) {
  const name = toTrimmedString(input.name, 120);
  const phone = toTrimmedString(input.phone, 25);
  const address = toTrimmedString(input.address, 300);
  const privacyConsentAccepted = input.privacyConsent === true || input.privacyConsent === "on";
  const errors: Partial<Record<"name" | "phone" | "address" | "privacyConsent", string>> = {};
  if (name.length < 2) errors.name = "Enter your full name.";
  if (!PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid contact number using 7 to 25 digits or common phone symbols.";
  if (requirePrivacyConsent && !privacyConsentAccepted) errors.privacyConsent = "Please provide consent before saving your Consumer profile.";
  return {
    data: { name, phone, address: address || null, privacyConsentAccepted },
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
