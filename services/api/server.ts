import "server-only";

import { NextResponse } from "next/server";

type ApiDependencyCheck = {
  name: string;
  ready: boolean;
};

export type ApiHealthReport = {
  status: "ok" | "degraded";
  route: string;
  dependencies: Array<{
    name: string;
    status: "ready" | "unavailable";
  }>;
  checkedAt: string;
};

type ApiCachePolicy = "no-store" | "public-short";

type ApiJsonOptions = {
  cache?: ApiCachePolicy;
};

type ApiLogContext = Record<string, boolean | number | string | null | undefined>;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const PUBLIC_SHORT_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
  "Vercel-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

function compactContext(context: ApiLogContext) {
  // Only our opaque enquiry reference is needed to join email and server logs.
  // Do not copy arbitrary context, provider messages, payloads or contacts.
  return typeof context.requestId === "string" && /^ENQ-[a-f0-9-]{36}$/i.test(context.requestId)
    ? { requestId: context.requestId } : {};
}

export function apiJson(
  payload: Record<string, unknown>,
  status = 200,
  options: ApiJsonOptions = {},
) {
  const isCacheable = options.cache === "public-short" && status >= 200 && status < 300;
  return NextResponse.json(payload, {
    status,
    headers: isCacheable ? PUBLIC_SHORT_CACHE_HEADERS : NO_STORE_HEADERS,
  });
}

export function createApiHealthReport(route: string, checks: ApiDependencyCheck[]): ApiHealthReport {
  const ready = checks.every((check) => check.ready);
  return {
    status: ready ? "ok" : "degraded",
    route,
    dependencies: checks.map((check) => ({
      name: check.name,
      status: check.ready ? "ready" : "unavailable",
    })),
    checkedAt: new Date().toISOString(),
  };
}

export function apiHealth(route: string, checks: ApiDependencyCheck[]) {
  const report = createApiHealthReport(route, checks);
  return apiJson({ ...report }, report.status === "ok" ? 200 : 503);
}

export function logApiError(route: string, error: unknown, context: ApiLogContext = {}) {
  const errorRecord = error && typeof error === "object" ? error as { code?: unknown; name?: unknown } : null;
  console.error(JSON.stringify({
    severity: "ERROR",
    event: "api_error",
    route,
    errorName: typeof errorRecord?.name === "string" && /^[A-Za-z]{1,60}$/.test(errorRecord.name) ? errorRecord.name : "Error",
    errorCode: typeof errorRecord?.code === "number" && Number.isSafeInteger(errorRecord.code) ? errorRecord.code
      : typeof errorRecord?.code === "string" && /^[a-z0-9_/-]{1,80}$/i.test(errorRecord.code) ? errorRecord.code : undefined,
    context: compactContext(context),
    timestamp: new Date().toISOString(),
  }));
}
