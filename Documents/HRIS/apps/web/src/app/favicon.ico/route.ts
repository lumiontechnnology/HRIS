export async function GET(): Promise<Response> {
  // Return no-content to satisfy browser favicon requests when no static favicon is present.
  return new Response(null, { status: 204 });
}
