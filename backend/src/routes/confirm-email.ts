import { Router } from 'express';
import { getServiceClient } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { asyncHandler } from '../lib/http.js';

export const confirmEmailRouter = Router();

confirmEmailRouter.post('/', asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'email is required' });
    return;
  }

  const admin = getServiceClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    logger.error('confirm-email', 'Failed to list users', error);
    res.status(500).json({ success: false, error: 'Could not confirm email' });
    return;
  }

  const user = data.users.find((entry) => entry.email?.toLowerCase() === email);
  if (user && !user.email_confirmed_at) {
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updateError) {
      logger.error('confirm-email', 'Failed to confirm user', updateError);
      res.status(500).json({ success: false, error: 'Could not confirm email' });
      return;
    }
  }

  res.json({ ok: true });
}));
