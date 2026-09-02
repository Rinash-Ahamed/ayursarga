export type GuidanceProfile = {
  wellnessPath: string;
  preferences: string[];
  district: string;
  budget: string;
  expectedDeliveryDate?: string;
  lastMenstrualPeriod?: string;
  consultationProvider?: string;
  preferredAppointmentDate?: string;
  preferredTimeSlot?: string;
};

export function formatGuidanceProfile(profile: GuidanceProfile) {
  return [
    `Wellness path: ${profile.wellnessPath}`,
    `Preferences: ${profile.preferences.join(", ")}`,
    profile.expectedDeliveryDate ? `Expected delivery date: ${profile.expectedDeliveryDate}` : null,
    profile.lastMenstrualPeriod ? `Last menstrual period: ${profile.lastMenstrualPeriod}` : null,
    profile.consultationProvider ? `Preferred consultant: ${profile.consultationProvider}` : null,
    profile.preferredAppointmentDate ? `Preferred appointment date: ${profile.preferredAppointmentDate}` : null,
    profile.preferredTimeSlot ? `Preferred time slot: ${profile.preferredTimeSlot}` : null,
    `Preferred district: ${profile.district}`,
    `Budget: ${profile.budget}`,
  ].filter(Boolean).join("\n");
}
