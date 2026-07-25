export type MatchProfile = {
  needs: string[];
  preferences: string[];
  district: string;
  budget: string;
};

export function formatMatchProfile(profile: MatchProfile) {
  const preferences = profile.preferences.length
    ? profile.preferences.join(", ")
    : "No additional care preferences selected";

  return [
    `Care goals: ${profile.needs.join(", ")}`,
    `Preferred district: ${profile.district}`,
    `Budget: ${profile.budget}`,
    `Stay preferences: ${preferences}`,
  ].join("\n");
}
