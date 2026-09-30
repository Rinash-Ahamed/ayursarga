import "server-only";

import { NextResponse } from "next/server";

export type ApiDependencyCheck = {
  name: string;
  ready: boolean;
};

export function apiJson(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiHealth(_route: string, checks: ApiDependencyCheck[]) {
  const ready = checks.every((check) => check.ready);
  return apiJson({
    status: ready ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
  }, ready ? 200 : 503);
}
