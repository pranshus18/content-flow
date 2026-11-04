/**
 * Vercel Edge: proxy /api to Render so the browser can use same-origin /api
 * without VITE_API_URL (avoids Vercel "public VITE_ prefix" friction).
 * Set API_PROXY_ORIGIN on Vercel, e.g. https://your-service.onrender.com
 */
export const config = {
  matcher: '/api/:path*',
};

export default async function middleware(request: Request): Promise<Response> {
  const origin = process.env.API_PROXY_ORIGIN?.trim().replace(/\/+$/, '');
  if (!origin) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'API proxy not configured. Set API_PROXY_ORIGIN on Vercel (Render URL, no trailing slash).',
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

  return fetch(target, init);
}
