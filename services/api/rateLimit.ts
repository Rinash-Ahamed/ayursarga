import "server-only";

import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

export function requestFingerprint(request: Request, namespace: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 160) || "unknown";
  return createHash("sha256").update(`${namespace}:${address}:${agent}`).digest("hex");
}

export function allowRequest(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) {
    for (const [entryKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(entryKey);
      if (buckets.size < MAX_BUCKETS) break;
    }
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (oldestKey) buckets.delete(oldestKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
