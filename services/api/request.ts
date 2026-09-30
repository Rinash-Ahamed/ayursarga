import "server-only";

export class RequestBodyError extends Error {
  constructor(message: string, public readonly status: 400 | 413 | 415) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readJsonBody(request: Request, maximumBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) throw new RequestBodyError("Send the request as JSON.", 415);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) throw new RequestBodyError("Request is too large.", 413);
  if (!request.body) throw new RequestBodyError("Request details are required.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  chunks.forEach((chunk) => { combined.set(chunk, offset); offset += chunk.byteLength; });
  try {
    return JSON.parse(new TextDecoder().decode(combined)) as unknown;
  } catch {
    throw new RequestBodyError("Enter valid request details.", 400);
  }
}
