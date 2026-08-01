import { GuestOnly } from "@/components/auth/RequireRole";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function ConsumerLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = (await searchParams).next;
  return <GuestOnly><LoginForm role="consumer" requestedPath={typeof next === "string" ? next : null} /></GuestOnly>;
}
