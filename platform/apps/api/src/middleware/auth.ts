import { Request, Response, NextFunction } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { supabaseAdmin, supabaseForUser } from '../lib/supabase';

export interface AuthenticatedRequest extends Request {
  user: User;
  userJwt: string;
  supabase: SupabaseClient;
  businessId?: string;
  businessStatus?: string;
}

/** Cast after requireAuth middleware has run. */
export function getAuthReq(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const authReq = req as AuthenticatedRequest;
  authReq.user = data.user;
  authReq.userJwt = token;
  authReq.supabase = supabaseForUser(token);
  next();
}

export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { data, error } = await supabaseAdmin
    .from('platform_admins')
    .select('id')
    .eq('id', authReq.user.id)
    .maybeSingle();

  if (error || !data) {
    res.status(403).json({ error: 'Platform admin access required' });
    return;
  }
  next();
}

export async function requireBusinessOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { data, error } = await authReq.supabase
    .from('businesses')
    .select('id, status')
    .eq('owner_user_id', authReq.user.id)
    .maybeSingle();

  if (error || !data) {
    res.status(403).json({ error: 'No business linked to this account' });
    return;
  }

  authReq.businessId = data.id;
  authReq.businessStatus = data.status;
  next();
}
