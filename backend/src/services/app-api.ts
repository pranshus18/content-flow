import { getServiceClient } from '../lib/supabase.js';
import { getUserRole, requireAdmin } from '../lib/roles.js';
import { logger } from '../lib/logger.js';
import { httpError } from '../lib/http.js';
import { resolveUserEmails } from '../lib/user-emails.js';
import { preprocessMedia } from './preprocess-media.js';
import { parseEditorTimeline } from '../lib/parse-editor-timeline.js';

const contentFields = [
  'title',
  'description',
  'platform',
  'status',
  'media_url',
  'media_type',
  'original_media_url',
  'enhanced_media_url',
  'scheduled_date',
  'published_at',
  'admin_notes',
  'admin_description',
  'preprocessing_status',
  'social_post_id',
  'likes_count',
  'comments_count',
  'shares_count',
  'reach_count',
  'watermark_logo_url',
  'vendor_logo_url',
  'watermark_website_url',
  'watermark_position',
  'vendor_logo_position',
  'platform_logo_throughout',
  'vendor_logo_throughout',
  'intro_frame_url',
  'outro_frame_url',
  'intro_frame_duration',
  'outro_frame_duration',
  'template_source_url',
  'template_frames_applied',
  'background_music_track_id',
  'background_music_volume',
  'editor_timeline',
  'editor_timeline_updated_at',
] as const;

const brandingFields = [
  'company_logo_url',
  'company_website_url',
  'company_name',
  'company_address',
  'company_phone',
  'company_email',
  'watermark_enabled',
  'watermark_position',
  'vendor_logo_position',
  'end_card_enabled',
  'end_card_duration',
  'intro_card_enabled',
  'intro_card_duration',
  'intro_frame_url',
  'outro_frame_url',
  'company_tagline',
  'intro_headline',
  'intro_features',
  'executor_name',
  'cta_text',
  'vendor_logo_url',
  'follow_cta_enabled',
  'follow_cta_text',
  'follow_cta_start_seconds',
  'follow_cta_duration',
  'follow_cta_repeat_seconds',
] as const;

const allowedPlatforms = new Set(['instagram', 'facebook', 'youtube']);

type ContentRow = Record<string, unknown> & {
  user_id: string;
  user_email?: string | null;
  user_first_name?: string;
  user_last_name?: string;
};

function pickFields<T extends string>(input: Record<string, unknown>, keys: readonly T[]) {
  const patch: Partial<Record<T, unknown>> = {};
  for (const key of keys) {
    if (key in input) patch[key] = input[key];
  }
  return patch;
}

function normalizeEditorTimelineField(value: unknown): unknown {
  if (value == null) return null;
  return parseEditorTimeline(value);
}

function pickContentPatch(input: Record<string, unknown>) {
  const patch = pickFields(input, contentFields);
  if ('editor_timeline' in patch) {
    patch.editor_timeline = normalizeEditorTimelineField(patch.editor_timeline);
  }
  return patch;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function attachUserInfo(rows: ContentRow[]) {
  const supabase = getServiceClient();
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  if (userIds.length === 0) return rows;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds);

  const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

  let emailMap = new Map<string, string>();
  try {
    emailMap = await resolveUserEmails(userIds);
  } catch (error) {
    logger.error('content', 'Failed to resolve submitter emails; returning content without emails', error);
  }

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      ...row,
      user_email: emailMap.get(row.user_id) || null,
      user_first_name: profile?.first_name || '',
      user_last_name: profile?.last_name || '',
    };
  });
}

export async function listContent(userId: string, onlyUserId?: string) {
  const supabase = getServiceClient();
  const role = await getUserRole(userId);
  let query = supabase.from('content').select('*').order('created_at', { ascending: false });

  if (role === 'admin') {
    if (onlyUserId) query = query.eq('user_id', onlyUserId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as ContentRow[];
  return role === 'admin' ? attachUserInfo(rows) : rows;
}

export async function createContent(userId: string, input: Record<string, unknown>) {
  const title = readString(input.title);
  if (!title) throw httpError(400, 'title is required');

  const platform = readString(input.platform) || 'instagram';
  if (!allowedPlatforms.has(platform)) {
    throw httpError(400, 'platform must be instagram, facebook, or youtube');
  }

  const mediaType = readString(input.media_type);
  if (mediaType && mediaType !== 'image' && mediaType !== 'video') {
    throw httpError(400, 'media_type must be image or video');
  }

  const mediaUrl = readString(input.media_url) || null;
  const scheduledDate = readString(input.scheduled_date) || null;
  let status = 'draft';
  if (scheduledDate) status = 'scheduled';
  else if (mediaUrl) status = 'pending';

  const supabase = getServiceClient();
  const editorTimeline =
    input.editor_timeline != null ? parseEditorTimeline(input.editor_timeline) : null;
  const editorTimelineUpdatedAt =
    typeof input.editor_timeline_updated_at === 'string'
      ? input.editor_timeline_updated_at
      : editorTimeline
        ? new Date().toISOString()
        : null;

  const { data, error } = await supabase
    .from('content')
    .insert({
      user_id: userId,
      title,
      description: readString(input.description) || null,
      platform,
      scheduled_date: scheduledDate,
      media_url: mediaUrl,
      media_type: mediaType || null,
      original_media_url: mediaUrl,
      status,
      preprocessing_status: mediaUrl ? 'pending' : null,
      editor_timeline: editorTimeline,
      editor_timeline_updated_at: editorTimelineUpdatedAt,
    })
    .select()
    .single();

  if (error) throw error;

  if (data.media_url) {
    void preprocessMedia({
      mediaUrl: data.media_url,
      contentId: data.id,
      mediaType: data.media_type,
      platform: data.platform,
    }).catch((err) => {
      logger.error('content', `Background preprocess failed for ${data.id}`, err);
    });
  }

  return data;
}

export async function updateContent(userId: string, id: string, input: Record<string, unknown>) {
  const supabase = getServiceClient();
  const role = await getUserRole(userId);
  const { data: existing, error: findError } = await supabase.from('content').select('id, user_id').eq('id', id).single();
  if (findError) throw findError;
  if (role !== 'admin' && existing.user_id !== userId) {
    throw httpError(403, 'You can only update your own content');
  }

  const { data, error } = await supabase
    .from('content')
    .update(pickContentPatch(input))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContent(userId: string, id: string) {
  const supabase = getServiceClient();
  const role = await getUserRole(userId);
  const { data: existing, error: findError } = await supabase.from('content').select('id, user_id').eq('id', id).single();
  if (findError) throw findError;
  if (role !== 'admin' && existing.user_id !== userId) {
    throw httpError(403, 'You can only delete your own content');
  }

  const { error } = await supabase.from('content').delete().eq('id', id);
  if (error) throw error;
}

export async function listUsersWithContent(userId: string) {
  await requireAdmin(userId);
  const rows = await listContent(userId);
  const grouped = new Map<string, { user_id: string; email: string; first_name: string; last_name: string; content_count: number }>();
  for (const row of rows) {
    const current = grouped.get(row.user_id) || {
      user_id: row.user_id,
      email: row.user_email || '',
      first_name: row.user_first_name || '',
      last_name: row.user_last_name || '',
      content_count: 0,
    };
    current.content_count += 1;
    grouped.set(row.user_id, current);
  }
  return [...grouped.values()].sort((a, b) => b.content_count - a.content_count);
}

export async function getBranding() {
  const { data, error } = await getServiceClient()
    .from('branding_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertBranding(userId: string, input: Record<string, unknown>) {
  await requireAdmin(userId);
  const supabase = getServiceClient();
  const existing = await getBranding();
  const patch = pickFields(input, brandingFields);
  if (!existing) {
    const { data, error } = await supabase
      .from('branding_settings')
      .insert({
        ...patch,
        watermark_enabled: patch.watermark_enabled ?? true,
        watermark_position: patch.watermark_position ?? 'bottom-right',
        vendor_logo_position: patch.vendor_logo_position ?? 'bottom-left',
        end_card_enabled: patch.end_card_enabled ?? true,
        end_card_duration: patch.end_card_duration ?? 5,
        intro_card_enabled: patch.intro_card_enabled ?? true,
        intro_card_duration: patch.intro_card_duration ?? 3,
        cta_text: patch.cta_text ?? 'Enquire now',
        follow_cta_enabled: patch.follow_cta_enabled ?? true,
        follow_cta_text: patch.follow_cta_text ?? 'Follow us',
        follow_cta_duration: patch.follow_cta_duration ?? 4,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('branding_settings')
    .update(patch)
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPublishingSettings(userId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('publishing_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from('publishing_settings')
    .insert({ user_id: userId })
    .select()
    .single();
  if (createError) throw createError;
  return created;
}

export async function updatePublishingSettings(userId: string, input: Record<string, unknown>) {
  const current = await getPublishingSettings(userId);
  const { data, error } = await getServiceClient()
    .from('publishing_settings')
    .update({
      auto_publish_enabled: input.auto_publish_enabled ?? current.auto_publish_enabled,
      publish_time: input.publish_time ?? current.publish_time,
    })
    .eq('id', current.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
