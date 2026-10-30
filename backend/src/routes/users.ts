import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { listUsersWithContent } from '../services/app-api.js';

export const usersRouter = Router();

usersRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await listUsersWithContent(req.user!.id));
}));
