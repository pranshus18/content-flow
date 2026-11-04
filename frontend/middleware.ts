import { proxyApiRequest } from './proxy-api-request';

/**
 * Proxies /api/* to Render (API_PROXY_ORIGIN). Use this instead of VITE_API_URL on Vercel.
 */
export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request): Promise<Response> {
  return proxyApiRequest(request);
}
