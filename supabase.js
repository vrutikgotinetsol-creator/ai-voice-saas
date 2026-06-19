const { createClient } = require('@supabase/supabase-js');

/**
 * Service-role client — bypasses ALL Row Level Security.
 * Use this ONLY for:
 *   - Platform admin routes (you, viewing all clients)
 *   - Vapi webhook handlers (the AI needs to read/write any business's data
 *     based on which phone number was called, not tied to a logged-in user)
 *   - Stripe webhook handlers
 *   - Cron jobs (SMS reminders across all businesses)
 *
 * NEVER send this key to a browser. It lives only in this Node process.
 */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Creates a request-scoped Supabase client using the caller's JWT.
 * All queries through this client are subject to Row Level Security —
 * a shop owner's token can only ever see their own business's rows.
 * Use this for all CLIENT dashboard routes.
 */
function supabaseForUser(userJwt) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = { supabaseAdmin, supabaseForUser };
