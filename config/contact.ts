const PHONE_NUMBER = "+919745566697";

/** Ayursarga's own support contact, never a hospital/consumer contact. */
export const AYURSARGA_PHONE = {
  display: "+91 97 455 666 97",
  href: `tel:${PHONE_NUMBER}`,
  whatsappUrl: `https://wa.me/${PHONE_NUMBER.slice(1)}`,
} as const;
