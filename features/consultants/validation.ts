import { isValidEmail, toTrimmedString } from "@/utils/text";

export type ConsultantFields = {
  name: string;
  email: string;
  contactNo: string;
  whatsappNo: string;
  qualification: string;
  yearsExperience: number;
  lastWorkedCompany: string;
  address: string;
  emergencyContactNo: string;
};

export type ConsultantField = keyof ConsultantFields;
export type ConsultantValidationErrors = Partial<Record<ConsultantField, string>>;

const PHONE_PATTERN = /^[+()\d\s-]{7,25}$/;

export function validateConsultantFields(input: Record<string, unknown>) {
  const data: ConsultantFields = {
    name: toTrimmedString(input.name, 120),
    email: toTrimmedString(input.email, 160).toLowerCase(),
    contactNo: toTrimmedString(input.contactNo, 25),
    whatsappNo: toTrimmedString(input.whatsappNo, 25),
    qualification: toTrimmedString(input.qualification, 200),
    yearsExperience: Number(input.yearsExperience),
    lastWorkedCompany: toTrimmedString(input.lastWorkedCompany, 160),
    address: toTrimmedString(input.address, 400),
    emergencyContactNo: toTrimmedString(input.emergencyContactNo, 25),
  };
  const errors: ConsultantValidationErrors = {};
  if (data.name.length < 2) errors.name = "Enter the consultant's name.";
  if (!isValidEmail(data.email)) errors.email = "Enter a valid email address.";
  if (!PHONE_PATTERN.test(data.contactNo)) errors.contactNo = "Enter a valid contact number.";
  if (!PHONE_PATTERN.test(data.whatsappNo)) errors.whatsappNo = "Enter a valid WhatsApp number.";
  if (data.qualification.length < 2) errors.qualification = "Enter the consultant's qualification.";
  if (!Number.isFinite(data.yearsExperience) || data.yearsExperience < 0 || data.yearsExperience > 80 || !Number.isInteger(data.yearsExperience * 2)) {
    errors.yearsExperience = "Experience must be between 0 and 80 years in 0.5-year steps.";
  }
  if (data.emergencyContactNo && !PHONE_PATTERN.test(data.emergencyContactNo)) {
    errors.emergencyContactNo = "Enter a valid emergency contact number.";
  }
  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

export function consultantFormValues(form: FormData): Record<string, unknown> {
  return {
    name: form.get("name"),
    email: form.get("email"),
    contactNo: form.get("contactNo"),
    whatsappNo: form.get("whatsappNo"),
    qualification: form.get("qualification"),
    yearsExperience: form.get("yearsExperience"),
    lastWorkedCompany: form.get("lastWorkedCompany"),
    address: form.get("address"),
    emergencyContactNo: form.get("emergencyContactNo"),
  };
}
