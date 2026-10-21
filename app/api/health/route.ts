import { type NextRequest, NextResponse } from "next/server";
import { apiJson } from "@/services/api/server";
import { platformHealthReport } from "@/services/api/platformHealth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  if (request.headers.get("accept")?.includes("text/html")) {
    const destination = new URL("/health", request.url);
    if (new URL(request.url).searchParams.get("deep") === "true") destination.searchParams.set("deep", "true");
    return NextResponse.redirect(destination, 307);
  }

  const report = platformHealthReport(new URL(request.url).searchParams.get("deep") === "true");
  return apiJson(report, report.status === "ok" ? 200 : 503);
}
