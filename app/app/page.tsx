import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function ConsumerFoundationPage() {
  redirect(ROUTES.public.home);
}
