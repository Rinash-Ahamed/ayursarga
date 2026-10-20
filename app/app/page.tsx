import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function ConsumerHomePage() {
  redirect(ROUTES.consumer.bookings);
}
