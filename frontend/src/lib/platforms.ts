/** Platforms offered in create/edit UI. Add `instagram` / `facebook` when re-enabled. */
export const ACTIVE_CONTENT_PLATFORMS = ['youtube'] as const;

export type ActiveContentPlatform = (typeof ACTIVE_CONTENT_PLATFORMS)[number];

export const DEFAULT_CONTENT_PLATFORM: ActiveContentPlatform = 'youtube';

export function isActiveContentPlatform(value: string): value is ActiveContentPlatform {
  return (ACTIVE_CONTENT_PLATFORMS as readonly string[]).includes(value);
}

/** Map legacy or unknown values to the current default selectable platform. */
export function coerceActiveContentPlatform(value: string | null | undefined): ActiveContentPlatform {
  return isActiveContentPlatform(value ?? '') ? value : DEFAULT_CONTENT_PLATFORM;
}

export const ACTIVE_CONTENT_PLATFORM_LABELS: Record<ActiveContentPlatform, string> = {
  youtube: 'YouTube',
};
