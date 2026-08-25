export type GuidanceProfile = {
  wellnessPath: string;
  preferences: string[];
  district: string;
  budget: string;
};

export function formatGuidanceProfile(profile: GuidanceProfile) {
  return [
    `Wellness path: ${profile.wellnessPath}`,
    `Preferences: ${profile.preferences.join(", ")}`,
    `Preferred district: ${profile.district}`,
    `Budget: ${profile.budget}`,
  ].join("\n");
}
