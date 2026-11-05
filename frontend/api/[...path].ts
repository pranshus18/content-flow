/**
 * Vercel Edge: same-origin /api/* → Render (API_PROXY_ORIGIN).
 * Browser never cross-origin calls Render, so CORS cannot block the app.
 */
export const config = {
  runtime: 'edge',
};

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function forwardHeaders(request: Request): Headers {
  const out = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.set(key, value);
  });
  return out;
}

export default async function handler(request: Request): Promise<Response> {
  const origin = process.env.API_PROXY_ORIGIN?.trim().replace(/\/+$/, '');
  if (!origin) {
    return Response.json(
      {
        success: false,
        error: 'Set API_PROXY_ORIGIN on Vercel to your Render URL (no trailing slash).',
      },
      { status: 502 },
    );
  }

  const incoming = new URL(request.url);
  const target = `${origin}${incoming.pathname}${incoming.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders(request),
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    return await fetch(target, init);
  } catch {
    return Response.json(
      {
        success: false,
        error: `Could not reach ${origin}. Wake Render via ${origin}/health and retry.`,
      },
      { status: 502 },
    );
  }
}
