const { supabaseAdmin, supabaseForUser } = require('../lib/supabase');

/**
 * Extracts and verifies the Supabase JWT from the Authorization header.
 * Attaches req.user (the authenticated Supabase user) and req.supabase
 * (a request-scoped, RLS-bound Supabase client) for downstream routes.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // Verify the token against Supabase Auth
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = data.user;
  req.userJwt = token;
  req.supabase = supabaseForUser(token); // RLS-scoped client for this request
  next();
}

/**
 * Requires the authenticated user to be a platform admin (you/staff).
 * Must run AFTER requireAuth.
 */
async function requirePlatformAdmin(req, res, next) {
  const { data, error } = await supabaseAdmin
    .from('platform_admins')
    .select('id')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error || !data) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
}

/**
 * Requires the authenticated user to own a business (shop owner / client).
 * Attaches req.businessId for convenience. Must run AFTER requireAuth.
 */
async function requireBusinessOwner(req, res, next) {
  const { data, error } = await req.supabase
    .from('businesses')
    .select('id, status')
    .eq('owner_user_id', req.user.id)
    .maybeSingle();

  if (error || !data) {
    return res.status(403).json({ error: 'No business linked to this account' });
  }
  req.businessId = data.id;
  req.businessStatus = data.status;
  next();
}

module.exports = { requireAuth, requirePlatformAdmin, requireBusinessOwner };
