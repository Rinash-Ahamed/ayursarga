import type { UserProfile } from "@/features/auth/contracts";

export const CONSUMER_PRIVACY_NOTICE_VERSION = "2026-09-23";
export const CUSTOMER_TERMS_VERSION = "2026-09-23";
export const BOOKING_TERMS_VERSION = "2026-09-23";

export function hasCurrentConsumerPrivacyConsent(profile: UserProfile | null | undefined) {
  return profile?.role === "consumer"
    && profile.privacyConsentVersion === CONSUMER_PRIVACY_NOTICE_VERSION
    && profile.privacyConsentAt !== null
    && profile.customerTermsVersion === CUSTOMER_TERMS_VERSION
    && profile.customerTermsAcceptedAt !== null;
}
