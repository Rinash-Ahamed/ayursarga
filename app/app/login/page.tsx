import { GuestOnly } from "@/components/auth/RequireRole";
import { ConsumerGoogleAuthForm } from "@/components/auth/ConsumerGoogleAuthForm";

export default async function ConsumerLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = (await searchParams).next;
  return <GuestOnly role="consumer"><ConsumerGoogleAuthForm mode="login" requestedPath={typeof next === "string" ? next : null} /></GuestOnly>;
}
