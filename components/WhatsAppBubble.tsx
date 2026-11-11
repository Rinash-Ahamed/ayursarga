import Image from "next/image";
import images from "@/config/image-assets.json";
import { AYURSARGA_PHONE } from "@/config/contact";

const WHATSAPP_URL = `${AYURSARGA_PHONE.whatsappUrl}?text=Hello%20Ayursarga%2C%20I%20would%20like%20guidance%20in%20finding%20Ayurvedic%20care.`;

export function WhatsAppLauncher({ rotating = false, active = true }: { rotating?: boolean; active?: boolean }) {
  return <a
    className={`whatsapp-bubble${rotating ? " support-launcher-option" : ""}`}
    data-active={active}
    aria-hidden={!active}
    inert={!active}
    tabIndex={active ? 0 : -1}
    href={WHATSAPP_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Chat with Ayursarga on WhatsApp at ${AYURSARGA_PHONE.display}`}
  >
    <span className="whatsapp-bubble-label" aria-hidden="true">
      <small>Personal guidance</small>
      <strong>Chat with Ayursarga</strong>
    </span>
    <span className="whatsapp-bubble-mark" aria-hidden="true">
      <Image className="whatsapp-bubble-image" src={images.whatsapp.src} alt="" width={42} height={42} loading="eager" unoptimized sizes="42px" />
    </span>
  </a>;
}

export default function WhatsAppBubble() {
  // With Ayu enabled, Nav's shared launcher owns both controls.
  return process.env.NEXT_PUBLIC_AYU_ONLINE === "true" ? null : <WhatsAppLauncher />;
}
