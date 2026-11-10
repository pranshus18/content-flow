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
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 2_500;
const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504, 505]);

type BackendOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Default 90s; use 10–12 min for video render endpoints. */
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** AbortSignal.timeout is missing in some browsers; without this, fetch throws immediately. */
function timeoutSignal(ms: number): AbortSignal {
  const AbortSignalCtor = globalThis.AbortSignal as typeof AbortSignal & {
    timeout?: (ms: number) => AbortSignal;
  };
  if (typeof AbortSignalCtor?.timeout === 'function') {
    return AbortSignalCtor.timeout(ms);
  }
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

function networkErrorMessage(base: string) {
  return (
    `Cannot reach the API at ${base}. ` +
    'This is usually Render waking up (free tier) or a brief network drop—not a wrong password. ' +
    `Open ${base}/health in a new tab, wait until you see "ok":true, then sign in again.`
  );
}

function readErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    const value = (data as { error?: unknown }).error;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function httpFailureMessage(status: number, data: unknown) {
  const fromBody = readErrorMessage(data, '');
  if (fromBody) return fromBody;
  if (status === 502 || status === 503 || status === 504 || status === 505) {
    return 'The API is temporarily unavailable (often Render waking up). Wait a moment and try again.';
  }
  if (status === 429) {
    return 'Too many requests. Please wait a few seconds and try again.';
  }
  return `Backend ${status}`;
}

function retryDelayMs(res: Response, attempt: number) {
  const retryAfter = res.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }
  return RETRY_DELAY_MS * attempt;
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
  const timeoutMs = options.timeoutMs ?? API_FETCH_TIMEOUT_MS;

  const init: RequestInit = {
    method,
    cache: 'no-store',
    signal: timeoutSignal(timeoutMs),
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      ...(sendBody ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    ...(sendBody ? { body: JSON.stringify(body ?? {}) } : {}),
  };

  let lastError: unknown;
  let res: Response | undefined;
  let data: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      res = await fetch(url, { ...init, signal: timeoutSignal(timeoutMs) });
      lastError = undefined;
    } catch (error: unknown) {
      lastError = error;
      res = undefined;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    }

    const text = await res.text();
    data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (!res.ok && attempt < MAX_ATTEMPTS && RETRYABLE_HTTP.has(res.status)) {
          await sleep(retryDelayMs(res, attempt));
          continue;
        }
        throw new Error(res.ok ? 'Backend returned a non-JSON response' : httpFailureMessage(res.status, null));
      }
    }

    if (res.status === 304) {
      throw new Error('Backend returned an empty cached response. Refresh the page and try again.');
    }

    if (res.ok) {
      return data as T;
    }

    const canRetry = RETRYABLE_HTTP.has(res.status) && attempt < MAX_ATTEMPTS;
    if (canRetry) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }

    throw new Error(httpFailureMessage(res.status, data));
  }

  const base = apiBase();
  if (isTimeoutError(lastError)) {
    throw new Error(
      'The API is taking too long to respond. On Render free tier the server may be waking up—wait about a minute and refresh.',
    );
  }
  throw new Error(
    base
      ? networkErrorMessage(base)
      : import.meta.env.PROD
        ? 'Cannot reach the API. On Vercel set API_PROXY_ORIGIN (see frontend/DEPLOY.md) and redeploy.'
        : 'Cannot reach the backend. Keep `npm run dev` running so the API on port 8081 is available.',
  );
}

/** Wake API before login (Render cold start). Uses same-origin /api when proxied on Vercel. */
export async function wakeBackendApi(): Promise<void> {
  if (!import.meta.env.PROD) return;
  const base = apiBase();
  const wakeUrl = base ? `${base}/health` : `${window.location.origin}/health`;
  try {
    await fetch(wakeUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: timeoutSignal(120_000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    // invokeBackend retries
  }
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
