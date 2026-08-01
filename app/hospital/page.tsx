import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function HospitalFoundationPage() {
  redirect(ROUTES.public.home);
}
