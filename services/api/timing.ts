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
    const measured = process.env.API_METRICS_ENABLED === "true";
    const cpu = measured ? process.cpuUsage() : undefined;
    let response: Response;
    try { response = await handler(...args); }
    catch (error) {
      // Track an escaped handler failure without logging its message or payload.
      console.error(JSON.stringify({ event: "api_unhandled_failure", route, status: 500,
        totalMs: Math.round(performance.now() - started) }));
      throw error;
    }
    const total = performance.now() - started;
    const stages = requests.getStore()!;
    response.headers.set("Server-Timing", ["total;dur=" + total.toFixed(1),
      ...Object.entries(stages).map(([stage, duration]) => `${stage};dur=${duration.toFixed(1)}`)].join(", "));
    // Numeric stages and a fixed route template only. No URLs, IDs, query
    // strings, headers, payloads or personal data enter performance logs.
    if (total >= 1000) console.info(JSON.stringify({ event: "slow_api", route, status: response.status,
      totalMs: Math.round(total), stagesMs: Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, Math.round(value)])) }));
    if (response.status >= 500) console.error(JSON.stringify({ event: "api_failed_response", route, status: response.status, totalMs: Math.round(total) }));
    if (measured) {
      const memory = process.memoryUsage();
      const used = process.cpuUsage(cpu);
      console.info(JSON.stringify({ event: "api_metrics", route, status: response.status, totalMs: Math.round(total),
        stagesMs: Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, Math.round(value)])),
        // Process-wide deltas/snapshots, NOT per-request CPU under concurrency.
        processCpuUserMs: used.user / 1000, processCpuSystemMs: used.system / 1000,
        processRssBytes: memory.rss, processHeapUsedBytes: memory.heapUsed }));
    }
    return response;
  });
}
