/**
 * Shared Vercel Edge proxy: browser → same-origin /api/* → Render (API_PROXY_ORIGIN).
 */
export async function proxyApiRequest(request: Request): Promise<Response> {
  const origin = process.env.API_PROXY_ORIGIN?.trim().replace(/\/+$/, '');
  if (!origin) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Set API_PROXY_ORIGIN on Vercel to your Render service URL (no trailing slash). You do not need VITE_API_URL when using the proxy.',
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  const incoming = new URL(request.url);
  const target = `${origin}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    return await fetch(target, init);
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Could not reach the API at ${origin}. If Render free tier was idle, wait a minute and retry.`,
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
}
