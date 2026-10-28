import type { ContactEmailData } from "@/lib/contactEmail";
import { isValidEmail } from "@/utils/text";
import { isValidPhoneNumber } from "@/utils/phone";

export type ContactSource = "contact" | "ayu";
const INTERESTS = new Set(["Ayurvedic hospital partnership", "Postnatal recovery", "Rejuvenation", "Stress management", "Women's wellness", "Prenatal and maternity care", "Baby care and lactation support", "I need personal guidance"]);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Syntax and high-confidence placeholder checks, not identity/email ownership verification. */
export function validateContactEnquiry(input: Record<string, unknown>, source: ContactSource = "contact") {
  const value = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const data: ContactEmailData = { name: value("name"), email: value("email").toLowerCase(), phone: value("phone"),
    interest: value("interest"), message: value("message"), guidanceProfile: value("guidanceProfile").slice(0, 1200) };
  const fail = (reason: string, error: string) => ({ data, reason, error });
  if (data.name.length < 2 || data.name.length > 100 || !/\p{L}/u.test(data.name) || /[\r\n]/.test(data.name) || CONTROL_CHARACTERS.test(data.name)) return fail("invalid_name", "Enter your name using 2 to 100 characters.");
  if (data.email.length > 160 || !isValidEmail(data.email) || /[\r\n]/.test(data.email) || CONTROL_CHARACTERS.test(data.email)) return fail("invalid_email", "Enter a valid email address where our team can reply.");
  const domain = data.email.slice(data.email.lastIndexOf("@") + 1).replace(/\.$/, "");
  if (["example.com", "example.net", "example.org"].some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`)) || /(^|\.)(test|invalid|example|localhost|local)$/.test(domain)) return fail("placeholder_email", "Enter your real email address, not an example or testing address.");
  if (!isValidPhoneNumber(data.phone)) return fail("invalid_phone", "Enter a 10-digit contact number.");
  if (/^(\d)\1{9}$/.test(data.phone)) return fail("placeholder_phone", "Enter your contact number, not a repeated-digit placeholder.");
  if (!INTERESTS.has(data.interest)) return fail("invalid_interest", "Choose the care you are interested in.");
  if ((source === "ayu" && !data.message) || data.message.length > 3000 || CONTROL_CHARACTERS.test(data.message)) return fail("invalid_message", "Enter your question using up to 3000 characters.");
  if (CONTROL_CHARACTERS.test(data.guidanceProfile)) return fail("invalid_guidance", "Please reopen the guidance form and try again.");
  return { data, reason: null, error: null };
}
