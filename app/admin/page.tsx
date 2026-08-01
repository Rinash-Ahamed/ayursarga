import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function AdminFoundationPage() {
  redirect(ROUTES.public.home);
}
