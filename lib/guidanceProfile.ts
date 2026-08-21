export type GuidanceProfile = {
  preferences: string[];
  district: string;
  budget: string;
};

export function formatGuidanceProfile(profile: GuidanceProfile) {
  return [
    `Stay preferences: ${profile.preferences.length ? profile.preferences.join(", ") : "No specific stay preferences selected"}`,
    `Preferred district: ${profile.district}`,
    `Budget: ${profile.budget}`,
  ].join("\n");
}
