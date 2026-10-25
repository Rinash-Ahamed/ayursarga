import type { ConsultantSlotTimings, ConsultantTimeSlot } from "@/features/consultants/validation";

export type PublicConsultant = {
  id: string; name: string; designation: string; qualification: string;
  yearsExperience: number; consultantCharge: number;
  preferredTimeSlots: ConsultantTimeSlot[]; preferredSlotTimings: ConsultantSlotTimings;
  preferredDays?: import("@/features/consultants/validation").ConsultantWeekDay[];
  availableDates?: string[];
};
export type ConsultantPage = { documents: PublicConsultant[]; cursor: number | null; hasMore: boolean };
