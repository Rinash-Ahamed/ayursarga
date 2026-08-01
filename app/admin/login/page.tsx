import { GuestOnly } from "@/components/auth/RequireRole";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = (await searchParams).next;
  return <GuestOnly><LoginForm role="admin" requestedPath={typeof next === "string" ? next : null} /></GuestOnly>;
}
