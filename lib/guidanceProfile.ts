export type GuidanceProfile = {
  preferences: string[];
  district: string;
  budget: string;
};

export function formatGuidanceProfile(profile: GuidanceProfile) {
  return [
    `Care concerns: ${profile.preferences.length ? profile.preferences.join(", ") : "No specific concerns selected"}`,
    `Preferred district: ${profile.district}`,
    `Budget: ${profile.budget}`,
  ].join("\n");
}
