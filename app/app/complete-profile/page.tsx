import { RequireRole } from "@/components/auth/RequireRole";
import { ConsumerProfile } from "@/components/consumer/ConsumerProfile";

export default async function ConsumerProfileCompletionPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = (await searchParams).next;
  const requestedPath = typeof next === "string" ? next : undefined;
  return <RequireRole role="consumer"><ConsumerProfile completion requestedPath={requestedPath} /></RequireRole>;
}
