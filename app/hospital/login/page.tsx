import { GuestOnly } from "@/components/auth/RequireRole";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function HospitalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = (await searchParams).next;
  return <GuestOnly><LoginForm role="hospital" requestedPath={typeof next === "string" ? next : null} /></GuestOnly>;
}
