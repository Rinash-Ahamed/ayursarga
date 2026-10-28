import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function AdminSecurityPage() {
  redirect(ROUTES.admin.settings);
}
