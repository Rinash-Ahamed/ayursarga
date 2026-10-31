import type { ConsultantSlotTimings, ConsultantTimeSlot } from "@/features/consultants/validation";

export type PublicConsultant = {
  imageUrl?: string | null;
  id: string; name: string; designation: string; qualification: string;
  // Public charge is the full consumer total, including Ayursarga commission.
  yearsExperience: number; consultantCharge: number;
  preferredTimeSlots: ConsultantTimeSlot[]; preferredSlotTimings: ConsultantSlotTimings;
  preferredDays?: import("@/features/consultants/validation").ConsultantWeekDay[];
  availableDates?: string[];
};
export type ConsultantPage = { documents: PublicConsultant[]; cursor: number | null; hasMore: boolean };
