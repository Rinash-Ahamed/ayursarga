import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type Stage = "auth" | "profile" | "database" | "provider";
type Timings = Partial<Record<Stage, number>>;
const requests = new AsyncLocalStorage<Timings>();

/** Request-local timings only. Never retain tokens, identities or request bodies. */
export async function timeApiStep<T>(stage: Stage, operation: () => Promise<T>): Promise<T> {
  const timings = requests.getStore();
  if (!timings) return operation();
  const started = performance.now();
  try { return await operation(); }
  finally { timings[stage] = (timings[stage] ?? 0) + performance.now() - started; }
}

/** Includes handler work, not platform startup or client/network time.
 * Concurrent stage durations can overlap; they must not be added to total.
 */
export function withApiTiming<Args extends unknown[]>(route: string, handler: (...args: Args) => Response | Promise<Response>) {
  return (...args: Args): Promise<Response> => requests.run({}, async () => {
    const started = performance.now();
    const response = await handler(...args);
    const total = performance.now() - started;
    const stages = requests.getStore()!;
    response.headers.set("Server-Timing", ["total;dur=" + total.toFixed(1),
      ...Object.entries(stages).map(([stage, duration]) => `${stage};dur=${duration.toFixed(1)}`)].join(", "));
    // Numeric stages and a fixed route template only. No URLs, IDs, query
    // strings, headers, payloads or personal data enter performance logs.
    if (total >= 1000) console.info(JSON.stringify({ event: "slow_api", route, status: response.status,
      totalMs: Math.round(total), stagesMs: Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, Math.round(value)])) }));
    return response;
  });
}
