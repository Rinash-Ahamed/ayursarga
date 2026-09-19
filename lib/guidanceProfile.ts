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

const GUIDANCE_PROFILE_STORAGE_KEY = "ayursarga-guidance-profile";

function isGuidanceProfile(value: unknown): value is GuidanceProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<GuidanceProfile>;
  return typeof profile.wellnessPath === "string"
    && Array.isArray(profile.preferences)
    && profile.preferences.every((item) => typeof item === "string")
    && typeof profile.district === "string"
    && typeof profile.budget === "string";
}

export function saveGuidanceProfile(profile: GuidanceProfile) {
  try {
    window.sessionStorage.setItem(GUIDANCE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // The form remains usable when browser storage is unavailable.
  }
}

export function loadGuidanceProfile() {
  try {
    const stored = window.sessionStorage.getItem(GUIDANCE_PROFILE_STORAGE_KEY);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    return isGuidanceProfile(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearGuidanceProfile() {
  try {
    window.sessionStorage.removeItem(GUIDANCE_PROFILE_STORAGE_KEY);
  } catch {
    // Nothing needs clearing when browser storage is unavailable.
  }
}

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
