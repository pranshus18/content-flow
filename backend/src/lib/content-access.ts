import { getUserRole } from './roles.js';
import { getServiceClient } from './supabase.js';
import { httpError } from './http.js';

export async function assertContentAccess(actorId: string, contentId: unknown) {
  if (typeof contentId !== 'string' || !contentId.trim()) {
    throw httpError(400, 'contentId is required');
  }

  if (actorId === 'cron') return contentId.trim();

  const id = contentId.trim();
  const { data, error } = await getServiceClient()
    .from('content')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw httpError(404, 'Content not found');

  const role = await getUserRole(actorId);
  if (role !== 'admin' && data.user_id !== actorId) {
    throw httpError(403, 'You can only access your own content');
  }

  return id;
}
