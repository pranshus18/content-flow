export function trimUrl(url?: string | null, max = 80): string | undefined {
  if (!url) return undefined;
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

function stamp() {
  return new Date().toISOString();
}

export const logger = {
  info(scope: string, message: string, extra?: unknown) {
    if (extra === undefined) {
      console.log(`[${stamp()}] [${scope}] ${message}`);
      return;
    }
    console.log(`[${stamp()}] [${scope}] ${message}`, extra);
  },
  warn(scope: string, message: string, extra?: unknown) {
    if (extra === undefined) {
      console.warn(`[${stamp()}] [${scope}] ${message}`);
      return;
    }
    console.warn(`[${stamp()}] [${scope}] ${message}`, extra);
  },
  error(scope: string, message: string, extra?: unknown) {
    if (extra === undefined) {
      console.error(`[${stamp()}] [${scope}] ${message}`);
      return;
    }
    console.error(`[${stamp()}] [${scope}] ${message}`, extra);
  },
};
