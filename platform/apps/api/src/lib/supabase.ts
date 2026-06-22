import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from '../config/env';

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node.js 18 lacks native WebSocket — required by @supabase/realtime-js
  realtime: { transport: ws as unknown as typeof WebSocket },
};

/**
 * Service-role client — bypasses ALL Row Level Security.
 * Use ONLY for: platform admin routes, webhooks, cron jobs.
 * NEVER expose to browsers.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);

/**
 * Request-scoped client bound to the caller's JWT.
 * All queries are subject to RLS — tenant isolation enforced by Postgres.
 */
export function supabaseForUser(userJwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
}

export type DatabaseTables =
  | 'platform_admins'
  | 'plans'
  | 'businesses'
  | 'locations'
  | 'services'
  | 'faqs'
  | 'customers'
  | 'appointments'
  | 'subscriptions'
  | 'call_logs'
  | 'call_transcripts'
  | 'leads'
  | 'daily_stats'
  | 'audit_logs';
