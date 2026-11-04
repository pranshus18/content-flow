import { getServiceClient } from '../lib/supabase.js';
import { httpError } from '../lib/http.js';
import { ADMIN_ASSET_MUSIC_PREFIX } from '../lib/music-catalog.js';
import { logger } from '../lib/logger.js';

const MEDIA_BUCKET = 'content-media';

type AdminAssetRow = {
  id: string;
  file_url: string;
  storage_path: string;
  name: string;
};

async function clearContentReferencesToAsset(asset: AdminAssetRow) {
  const supabase = getServiceClient();
  const musicTrackId = `${ADMIN_ASSET_MUSIC_PREFIX}${asset.id}`;

  const { error: musicError } = await supabase
    .from('content')
    .update({ background_music_track_id: null })
    .eq('background_music_track_id', musicTrackId);
  if (musicError) {
    throw new Error(`Failed to clear music references: ${musicError.message}`);
  }

  const urlFields = [
    'watermark_logo_url',
    'vendor_logo_url',
    'intro_frame_url',
    'outro_frame_url',
  ] as const;

  for (const field of urlFields) {
    const { error } = await supabase
      .from('content')
      .update({ [field]: null })
      .eq(field, asset.file_url);
    if (error) {
      throw new Error(`Failed to clear content ${field}: ${error.message}`);
    }
  }
}

export async function deleteAdminAssetRecord(assetId: string) {
  const supabase = getServiceClient();
  const id = assetId.trim();
  if (!id) throw httpError(400, 'Asset id is required');

  const { data: asset, error: fetchError } = await supabase
    .from('admin_assets')
    .select('id, file_url, storage_path, name')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!asset) throw httpError(404, 'Asset not found');

  await clearContentReferencesToAsset(asset as AdminAssetRow);

  const { error: dbError } = await supabase.from('admin_assets').delete().eq('id', id);
  if (dbError) {
    throw new Error(`Failed to delete asset from database: ${dbError.message}`);
  }

  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
  if (storageError) {
    logger.warn('admin-assets', 'Storage object remove failed after DB delete', {
      assetId: id,
      path: asset.storage_path,
      message: storageError.message,
    });
  }

  return { id, name: asset.name };
}
