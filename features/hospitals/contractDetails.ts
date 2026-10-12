import { toTrimmedString } from "@/utils/text";

export type HospitalContractDetails = {
  legalEntityType: string;
  registrationNumber: string;
  panNumber: string;
  gstin: string;
  contractEffectiveDate: string;
  contractExpiryDate: string;
  emergencyContact: string;
  emergencyReferralHospital: string;
};

export type HospitalContractDetailField = keyof HospitalContractDetails;
export type HospitalContractDetailErrors = Partial<Record<HospitalContractDetailField, string>>;

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateHospitalContractDetails(input: Record<string, unknown>) {
  const data: HospitalContractDetails = {
    legalEntityType: toTrimmedString(input.legalEntityType, 100),
    registrationNumber: toTrimmedString(input.registrationNumber, 100),
    panNumber: toTrimmedString(input.panNumber, 10).toUpperCase(),
    gstin: toTrimmedString(input.gstin, 20).toUpperCase(),
    contractEffectiveDate: toTrimmedString(input.contractEffectiveDate, 10),
    contractExpiryDate: toTrimmedString(input.contractExpiryDate, 10),
    emergencyContact: toTrimmedString(input.emergencyContact, 160),
    emergencyReferralHospital: toTrimmedString(input.emergencyReferralHospital, 200),
  };
  const errors: HospitalContractDetailErrors = {};

  if (data.legalEntityType.length < 2) errors.legalEntityType = "Enter the partner's legal entity type.";
  if (data.registrationNumber.length < 2) errors.registrationNumber = "Enter the partner's registration number.";
  if (!PAN_PATTERN.test(data.panNumber)) errors.panNumber = "Enter a valid 10-character PAN.";
  if (data.gstin !== "NOT APPLICABLE" && !GSTIN_PATTERN.test(data.gstin)) errors.gstin = "Enter a valid GSTIN or NOT APPLICABLE.";
  if (!DATE_PATTERN.test(data.contractEffectiveDate)) errors.contractEffectiveDate = "Select the agreement effective date.";
  if (!DATE_PATTERN.test(data.contractExpiryDate)) errors.contractExpiryDate = "Select the expiry date.";
  if (DATE_PATTERN.test(data.contractEffectiveDate) && DATE_PATTERN.test(data.contractExpiryDate)
    && data.contractExpiryDate < data.contractEffectiveDate) {
    errors.contractExpiryDate = "The expiry date must be on or after the effective date.";
  }
  if (data.emergencyContact.length < 5) errors.emergencyContact = "Enter the partner's emergency contact.";
  if (data.emergencyReferralHospital.length < 2) errors.emergencyReferralHospital = "Enter the nearby hospital or emergency transfer arrangement.";

  return { data, errors, isValid: Object.keys(errors).length === 0 };
}
