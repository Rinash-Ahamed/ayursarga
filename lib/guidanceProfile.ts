export type GuidanceProfile = {
  wellnessPath: string;
  preferences: string[];
  district: string;
  budget: string;
  expectedDeliveryDate?: string;
  lastMenstrualPeriod?: string;
};

export function formatGuidanceProfile(profile: GuidanceProfile) {
  return [
    `Wellness path: ${profile.wellnessPath}`,
    `Preferences: ${profile.preferences.join(", ")}`,
    profile.expectedDeliveryDate ? `Expected delivery date: ${profile.expectedDeliveryDate}` : null,
    profile.lastMenstrualPeriod ? `Last menstrual period: ${profile.lastMenstrualPeriod}` : null,
    `Preferred district: ${profile.district}`,
    `Budget: ${profile.budget}`,
  ].filter(Boolean).join("\n");
}
