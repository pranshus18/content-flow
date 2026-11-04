import { supabase } from '@/integrations/supabase/client';

function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '');
  }
  return '';
}

function apiUrl(path: string): string {
  const clean = String(path || '').replace(/^\/+/, '').replace(/^api\//, '');
  return `${apiBase()}/api/${clean}`;
}

/** Render free tier can take 30–90s to cold-start; avoid hanging the UI forever. */
const API_FETCH_TIMEOUT_MS = 90_000;

type BackendOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

function readErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    const value = (data as { error?: unknown }).error;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

export async function invokeBackend<T>(
  path: string,
  body?: unknown,
  options: BackendOptions = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const method = options.method || (body === undefined ? 'GET' : 'POST');
  const url = apiUrl(path);
  const sendBody = method !== 'GET' && method !== 'DELETE';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        ...(sendBody ? { 'Content-Type': 'application/json' } : {}),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      ...(sendBody ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch (error: unknown) {
    const timedOut =
      error instanceof DOMException && error.name === 'TimeoutError';
    if (timedOut) {
      throw new Error(
        'The API is taking too long to respond. On Render free tier the server may be waking up—wait about a minute and refresh.',
      );
    }
    const base = apiBase();
    throw new Error(
      base
        ? `Cannot reach the API at ${base}.`
        : import.meta.env.PROD
          ? 'Cannot reach the API. On Vercel set API_PROXY_ORIGIN (see frontend/DEPLOY.md) and redeploy.'
          : 'Cannot reach the backend. Keep `npm run dev` running so the API on port 8081 is available.',
    );
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(res.ok ? 'Backend returned a non-JSON response' : `Backend ${res.status}`);
    }
  }

  if (res.status === 304) {
    throw new Error('Backend returned an empty cached response. Refresh the page and try again.');
  }

  if (!res.ok) {
    throw new Error(readErrorMessage(data, `Backend ${res.status}`));
  }

  return data as T;
}

export async function downloadBackend(path: string): Promise<{ blob: Blob; fileName: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = apiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/octet-stream',
        'Cache-Control': 'no-cache',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    });
  } catch {
    throw new Error('Cannot reach the backend to download this file. Keep the API running and try again.');
  }

  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const data = await res.json();
      message = readErrorMessage(data, message);
    } catch {
      // keep status message
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const rawName = utfMatch?.[1] || plainMatch?.[1] || 'download';
  return { blob, fileName: decodeURIComponent(rawName.trim()) };
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
