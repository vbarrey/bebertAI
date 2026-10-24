// Docker healthcheck: answers once the start-up (instrumentation.ts) is done.
export function GET() {
  return Response.json({ ok: true });
}
