import { httpError } from './http.js';
import { getServiceClient } from './supabase.js';

export async function getUserRole(userId: string): Promise<'admin' | 'user'> {
  const { data, error } = await getServiceClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role === 'admin' ? 'admin' : 'user';
}

export async function requireAdmin(userId: string) {
  const role = await getUserRole(userId);
  if (role !== 'admin') {
    throw httpError(403, 'Admin access required');
  }
  return role;
}

const ADMIN_EMAIL = 'admin@contentflow.com';

export async function syncUserProfile(
  userId: string,
  email?: string,
  profile?: { firstName?: string; lastName?: string; phone?: string | null },
) {
  const supabase = getServiceClient();
  const firstName = (profile?.firstName || '').trim();
  const lastName = (profile?.lastName || '').trim();
  const phone = profile?.phone?.trim() || null;
  const isAdminEmail = email?.trim().toLowerCase() === ADMIN_EMAIL;

  const { data: existing, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  if (!existing) {
    const { error: insertError } = await supabase.from('profiles').insert({
      user_id: userId,
      first_name: firstName || (isAdminEmail ? 'Admin' : 'User'),
      last_name: lastName || (isAdminEmail ? 'User' : ''),
      phone,
    });
    if (insertError) throw insertError;
    return;
  }

  const patch: Record<string, string | null> = {};
  if (firstName && firstName !== existing.first_name) patch.first_name = firstName;
  if (lastName && lastName !== existing.last_name) patch.last_name = lastName;
  if (phone && phone !== existing.phone) patch.phone = phone;
  if (Object.keys(patch).length === 0) return;

  const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', existing.id);
  if (updateError) throw updateError;
}

export async function syncUserRole(
  userId: string,
  email?: string,
  profile?: { firstName?: string; lastName?: string; phone?: string | null },
) {
  const supabase = getServiceClient();
  const targetRole: 'admin' | 'user' = email?.trim().toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
  await syncUserProfile(userId, email, profile);

  const { data: existing, error } = await supabase
    .from('user_roles')
    .select('id, role')
    .eq('user_id', userId);
  if (error) throw error;

  const rows = existing || [];
  const matching = rows.find((row) => row.role === targetRole);

  if (matching) {
    const extras = rows.filter((row) => row.id !== matching.id).map((row) => row.id);
    if (extras.length > 0) {
      const { error: deleteError } = await supabase.from('user_roles').delete().in('id', extras);
      if (deleteError) throw deleteError;
    }
    return { role: targetRole, isAdmin: targetRole === 'admin' };
  }

  if (rows.length > 0) {
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ role: targetRole })
      .eq('id', rows[0].id);
    if (updateError) throw updateError;

    const extras = rows.slice(1).map((row) => row.id);
    if (extras.length > 0) {
      const { error: deleteError } = await supabase.from('user_roles').delete().in('id', extras);
      if (deleteError) throw deleteError;
    }
  } else {
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: targetRole });
    if (insertError) throw insertError;
  }

  return { role: targetRole, isAdmin: targetRole === 'admin' };
}
