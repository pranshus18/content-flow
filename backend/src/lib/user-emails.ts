import { getServiceClient } from './supabase.js';
import { logger } from './logger.js';

type EmailCacheEntry = { email: string; expiresAt: number };

const EMAIL_CACHE = new Map<string, EmailCacheEntry>();
const EMAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const LOOKUP_CONCURRENCY = 8;

/** Resolve emails only for the given user IDs (cached). Avoids listUsers() on every admin request. */
export async function resolveUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const now = Date.now();
  const missing: string[] = [];

  for (const id of unique) {
    const hit = EMAIL_CACHE.get(id);
    if (hit && hit.expiresAt > now) {
      result.set(id, hit.email);
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) return result;

  const supabase = getServiceClient();

  for (let i = 0; i < missing.length; i += LOOKUP_CONCURRENCY) {
    const chunk = missing.slice(i, i + LOOKUP_CONCURRENCY);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(id);
          if (error) {
            logger.warn('user-emails', 'getUserById failed', { userId: id, message: error.message });
            return;
          }
          const email = data.user?.email?.trim();
          if (!email) return;
          EMAIL_CACHE.set(id, { email, expiresAt: now + EMAIL_CACHE_TTL_MS });
          result.set(id, email);
        } catch (error) {
          logger.warn('user-emails', 'getUserById threw', { userId: id, error });
        }
      }),
    );
  }

  return result;
}
