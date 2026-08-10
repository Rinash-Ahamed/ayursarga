import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function ConsumerForgotPasswordPage() {
  redirect(ROUTES.consumer.login);
}
