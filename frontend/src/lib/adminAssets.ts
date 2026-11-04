import { supabase } from '@/integrations/supabase/client';
import { invokeBackend } from '@/lib/backend';

export type AdminAssetCategory =
  | 'platform_logo'
  | 'vendor_logo'
  | 'template_frame'
  | 'document'
  | 'background_music'
  | 'other';

export type AdminAsset = {
  id: string;
  name: string;
  category: AdminAssetCategory;
  file_url: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
};

const MEDIA_BUCKET = 'content-media';

export const ADMIN_ASSET_CATEGORY_LABELS: Record<AdminAssetCategory, string> = {
  platform_logo: 'Platform logo',
  vendor_logo: 'Vendor logo',
  template_frame: 'Intro / outro frame',
  document: 'Document',
  background_music: 'Background music',
  other: 'Other',
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function inferCategory(file: File, preferred?: AdminAssetCategory): AdminAssetCategory {
  if (preferred) return preferred;
  if (file.type.startsWith('audio/')) return 'background_music';
  if (file.type.startsWith('image/')) return 'other';
  return 'document';
}

export async function listAdminAssets(category?: AdminAssetCategory): Promise<AdminAsset[]> {
  let query = supabase
    .from('admin_assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AdminAsset[];
}

export async function uploadAdminAsset(
  file: File,
  options: { category?: AdminAssetCategory; name?: string } = {},
): Promise<AdminAsset> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to upload assets.');

  const category = inferCategory(file, options.category);
  const baseName = options.name?.trim() || file.name.replace(/\.[^.]+$/, '') || 'asset';
  const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const fileId = crypto.randomUUID();
  const fileName = ext ? `${sanitizeFileName(baseName)}.${ext}` : sanitizeFileName(baseName);
  const storagePath = `${user.id}/assets/${fileId}-${fileName}`;

  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  const fileUrl = urlData.publicUrl;

  const { data, error } = await supabase
    .from('admin_assets')
    .insert({
      name: baseName,
      category,
      file_url: fileUrl,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    throw error;
  }

  return data as AdminAsset;
}

/** Removes DB row, storage file, and clears content that referenced this asset. */
export async function deleteAdminAsset(asset: AdminAsset | { id: string }): Promise<void> {
  await invokeBackend<{ success: boolean; id: string; name?: string }>(
    `admin-assets/${encodeURIComponent(asset.id)}`,
    undefined,
    { method: 'DELETE' },
  );
}

export function isImageAsset(asset: AdminAsset): boolean {
  if (asset.mime_type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(asset.file_url);
}

export function isAudioAsset(asset: AdminAsset): boolean {
  if (asset.mime_type?.startsWith('audio/')) return true;
  return /\.(mp3|mpeg|wav|m4a|aac|ogg|flac|webm)(\?|$)/i.test(asset.file_url);
}
