import "server-only";

export function requestAuditDevice(request: Request) {
  return {
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    platform: null,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  };
}
