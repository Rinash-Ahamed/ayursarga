import { createRoot } from "react-dom/client";
import AyuBuddy from "@/components/AyuBuddy";
import WhatsAppBubble from "@/components/WhatsAppBubble";

createRoot(document.getElementById("fixture-root")!).render(<><WhatsAppBubble /><AyuBuddy /></>);
