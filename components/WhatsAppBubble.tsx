import Image from "next/image";
import { AYURSARGA_PHONE } from "@/config/contact";

const WHATSAPP_URL = `${AYURSARGA_PHONE.whatsappUrl}?text=Hello%20Ayursarga%2C%20I%20would%20like%20guidance%20in%20finding%20Ayurvedic%20care.`;

export default function WhatsAppBubble() {
  return <a
    className="whatsapp-bubble"
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
      <Image className="whatsapp-bubble-image" src="/whatsapp.png" alt="" width={42} height={42} loading="eager" quality={90} sizes="42px" />
    </span>
  </a>;
}
