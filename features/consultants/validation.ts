import { isValidEmail, toTrimmedString } from "@/utils/text";
import { isValidPhoneNumber } from "@/utils/phone";
import { isIsoDate } from "@/utils/date";
import { CONSULTATION_SERVICES, consultationService, type ConsultationServiceId } from "@/features/consultations/catalog";

export const CONSULTANT_TIME_SLOTS = ["morning", "noon", "evening"] as const;
export const CONSULTANT_WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type ConsultantWeekDay = typeof CONSULTANT_WEEK_DAYS[number];
export const CONSULTANT_DAY_LABELS: Record<ConsultantWeekDay, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
export type ConsultantTimeSlot = typeof CONSULTANT_TIME_SLOTS[number];
export type ConsultantSlotTimings = Partial<Record<ConsultantTimeSlot, { startTime: string; endTime: string }>>;
// Defaults for new selections; admins can override times per consultant.
export const CONSULTANT_TIME_SLOT_CONFIG: Record<ConsultantTimeSlot, { label: string; startTime: string; endTime: string }> = {
  morning: { label: "Morning", startTime: "09:00", endTime: "12:00" },
  noon: { label: "Noon", startTime: "12:00", endTime: "15:00" },
  evening: { label: "Evening", startTime: "15:00", endTime: "18:00" },
};
export function formatConsultantTimeSlot(slot: ConsultantTimeSlot, timings?: ConsultantSlotTimings) {
  const { label } = CONSULTANT_TIME_SLOT_CONFIG[slot];
  const { startTime, endTime } = timings?.[slot] ?? CONSULTANT_TIME_SLOT_CONFIG[slot];
  const format = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  };
  return `${label}: ${format(startTime)} – ${format(endTime)}`;
}

export type ConsultantFields = {
  name: string;
  designation: string;
  consultantCharge: number | null;
  consultationServices: ConsultationServiceId[];
  preferredDays: ConsultantWeekDay[];
  availableDates: string[];
  preferredTimeSlots: ConsultantTimeSlot[];
  preferredSlotTimings: ConsultantSlotTimings;
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

export function validateConsultantFields(input: Record<string, unknown>) {
  const data: ConsultantFields = {
    name: toTrimmedString(input.name, 120),
    designation: toTrimmedString(input.designation, 120),
    consultationServices: CONSULTATION_SERVICES.filter((service) => Array.isArray(input.consultationServices) && input.consultationServices.includes(service.id)).map((service) => service.id),
    consultantCharge: input.consultantCharge == null || (typeof input.consultantCharge === "string" && !input.consultantCharge.trim()) ? null : Number(input.consultantCharge),
    preferredTimeSlots: CONSULTANT_TIME_SLOTS.filter((slot) => Array.isArray(input.preferredTimeSlots) && input.preferredTimeSlots.includes(slot)),
    preferredDays: CONSULTANT_WEEK_DAYS.filter((day) => Array.isArray(input.preferredDays) && input.preferredDays.includes(day)),
    availableDates: Array.isArray(input.availableDates) ? input.availableDates.filter((date): date is string => typeof date === "string").toSorted() : [],
    preferredSlotTimings: {},
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
  if (input.availableDates != null && (!Array.isArray(input.availableDates) || input.availableDates.length > 31
    || input.availableDates.some((date: unknown) => typeof date !== "string" || !isIsoDate(date))
    || new Set(input.availableDates).size !== input.availableDates.length)) {
    errors.availableDates = "Choose up to 31 valid specific dates, without duplicates.";
  }
  if (input.preferredDays != null && (!Array.isArray(input.preferredDays)
    || input.preferredDays.length > CONSULTANT_WEEK_DAYS.length
    || input.preferredDays.some((day: unknown) => !CONSULTANT_WEEK_DAYS.includes(day as ConsultantWeekDay))
    || new Set(input.preferredDays).size !== input.preferredDays.length)) {
    errors.preferredDays = "Select valid days from Mon to Sun, without duplicates.";
  }
  if (input.consultationServices != null && (!Array.isArray(input.consultationServices)
    || input.consultationServices.length > CONSULTATION_SERVICES.length
    || input.consultationServices.some((value: unknown) => !consultationService(value))
    || new Set(input.consultationServices).size !== input.consultationServices.length)) errors.consultationServices = "Select valid consultation services without duplicates.";
  if (data.consultantCharge !== null && (
    !["string", "number"].includes(typeof input.consultantCharge) ||
    !/^\d+(\.\d{1,2})?$/.test(String(input.consultantCharge).trim()) ||
    !Number.isFinite(data.consultantCharge) || data.consultantCharge < 0 ||
    !Number.isSafeInteger(Math.round(data.consultantCharge * 100))
  )) errors.consultantCharge = "Enter a valid non-negative charge with up to 2 decimal places.";
  const timings = input.preferredSlotTimings;
  if (timings != null && (typeof timings !== "object" || Array.isArray(timings) || Object.keys(timings).some((key) => !data.preferredTimeSlots.includes(key as ConsultantTimeSlot)))) {
    errors.preferredSlotTimings = "Provide timings only for the selected slots.";
  } else {
    for (const slot of data.preferredTimeSlots) {
      const defaults = CONSULTANT_TIME_SLOT_CONFIG[slot];
      const timing = timings && Object.hasOwn(timings, slot) ? (timings as ConsultantSlotTimings)[slot] : { startTime: defaults.startTime, endTime: defaults.endTime };
      if (typeof timing !== "object" || !timing || Object.keys(timing).some((key) => !["startTime", "endTime"].includes(key)) ||
        typeof timing.startTime !== "string" || typeof timing.endTime !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(timing.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timing.endTime) || timing.endTime <= timing.startTime) {
        errors.preferredSlotTimings = "Enter valid start and end times for each selected slot. End time must be after start time.";
      } else data.preferredSlotTimings[slot] = { startTime: timing.startTime, endTime: timing.endTime };
    }
  }
  if (input.designation != null && (typeof input.designation !== "string" || input.designation.trim().length > 120)) errors.designation = "Enter a designation of up to 120 characters.";
  if (input.preferredTimeSlots != null && (!Array.isArray(input.preferredTimeSlots) || input.preferredTimeSlots.length > 3 || input.preferredTimeSlots.some((slot: unknown) => !CONSULTANT_TIME_SLOTS.includes(slot as ConsultantTimeSlot)) || new Set(input.preferredTimeSlots).size !== input.preferredTimeSlots.length)) {
    errors.preferredTimeSlots = "Choose Morning, Noon or Evening, without duplicates.";
  }
  if (data.name.length < 2) errors.name = "Enter the consultant's name.";
  if (!isValidEmail(data.email)) errors.email = "Enter a valid email address.";
  if (!isValidPhoneNumber(data.contactNo)) errors.contactNo = "Enter a 10-digit contact number.";
  if (!isValidPhoneNumber(data.whatsappNo)) errors.whatsappNo = "Enter a 10-digit WhatsApp number.";
  if (data.qualification.length < 2) errors.qualification = "Enter the consultant's qualification.";
  if (!Number.isFinite(data.yearsExperience) || data.yearsExperience < 0 || data.yearsExperience > 80 || !Number.isInteger(data.yearsExperience * 2)) {
    errors.yearsExperience = "Experience must be between 0 and 80 years in 0.5-year steps.";
  }
  if (data.emergencyContactNo && !isValidPhoneNumber(data.emergencyContactNo)) {
    errors.emergencyContactNo = "Enter a 10-digit emergency contact number.";
  }
  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

export function consultantFormValues(form: FormData): Record<string, unknown> {
  return {
    name: form.get("name"),
    designation: form.get("designation"),
    consultantCharge: form.get("consultantCharge"),
    consultationServices: form.getAll("consultationServices"),
    preferredDays: form.getAll("preferredDays"),
    availableDates: form.getAll("availableDates"),
    preferredTimeSlots: form.getAll("preferredTimeSlots"),
    preferredSlotTimings: Object.fromEntries(CONSULTANT_TIME_SLOTS.filter((slot) => form.getAll("preferredTimeSlots").includes(slot)).map((slot) => [slot, {
      startTime: form.get(`${slot}StartTime`) ?? CONSULTANT_TIME_SLOT_CONFIG[slot].startTime,
      endTime: form.get(`${slot}EndTime`) ?? CONSULTANT_TIME_SLOT_CONFIG[slot].endTime,
    }])),
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
