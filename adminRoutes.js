const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requirePlatformAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requirePlatformAdmin);

// ── List all clients with quick stats ──────────────────────────────────
router.get('/clients', async (req, res) => {
  const { data: businesses, error } = await supabaseAdmin
    .from('businesses')
    .select('*, subscriptions(*)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Attach appointment counts (one query, grouped client-side for simplicity)
  const { data: apptCounts } = await supabaseAdmin
    .from('appointments')
    .select('business_id, status');

  const counts = {};
  for (const row of apptCounts || []) {
    counts[row.business_id] = counts[row.business_id] || { total: 0, confirmed: 0, cancelled: 0 };
    counts[row.business_id].total++;
    if (row.status === 'confirmed') counts[row.business_id].confirmed++;
    if (row.status === 'cancelled') counts[row.business_id].cancelled++;
  }

  const enriched = businesses.map((b) => ({
    ...b,
    appointment_stats: counts[b.id] || { total: 0, confirmed: 0, cancelled: 0 },
  }));

  res.json(enriched);
});

// ── Platform-wide summary stats ────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const { data: businesses } = await supabaseAdmin.from('businesses').select('status');
  const { data: subs } = await supabaseAdmin.from('subscriptions').select('status, amount_cents');
  const { data: appts } = await supabaseAdmin
    .from('appointments')
    .select('id, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const activeCount = (businesses || []).filter((b) => b.status === 'active').length;
  const trialCount = (businesses || []).filter((b) => b.status === 'trial').length;
  const mrr = (subs || [])
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount_cents || 0), 0) / 100;

  res.json({
    totalClients: (businesses || []).length,
    activeClients: activeCount,
    trialClients: trialCount,
    mrr,
    appointmentsLast30Days: (appts || []).length,
  });
});

// ── Get one client's full detail ───────────────────────────────────────
router.get('/clients/:id', async (req, res) => {
  const { data: business, error } = await supabaseAdmin
    .from('businesses')
    .select('*, subscriptions(*), services(*), faqs(*)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!business) return res.status(404).json({ error: 'Client not found' });

  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('business_id', req.params.id)
    .order('start_time', { ascending: false })
    .limit(100);

  const { data: callLogs } = await supabaseAdmin
    .from('call_logs')
    .select('*')
    .eq('business_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(50);

  res.json({ ...business, appointments, callLogs });
});

// ── Create a new client (onboarding) ───────────────────────────────────
// Creates: Supabase Auth user (owner login) + businesses row linked to it
router.post('/clients', async (req, res) => {
  const { ownerEmail, ownerPassword, ...businessFields } = req.body;

  if (!ownerEmail || !ownerPassword || !businessFields.name) {
    return res.status(400).json({ error: 'ownerEmail, ownerPassword, and name are required' });
  }

  // 1. Create the Supabase Auth user for the shop owner
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true, // skip email verification since you're onboarding manually
  });

  if (userError) return res.status(400).json({ error: `Could not create login: ${userError.message}` });

  // 2. Create the linked business row
  const { data: business, error: bizError } = await supabaseAdmin
    .from('businesses')
    .insert({
      owner_user_id: userData.user.id,
      status: 'trial',
      trial_started_at: new Date().toISOString(),
      ...businessFields,
    })
    .select()
    .single();

  if (bizError) {
    // Roll back the auth user if business creation failed
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    return res.status(400).json({ error: bizError.message });
  }

  // 3. Create an initial trialing subscription row
  await supabaseAdmin.from('subscriptions').insert({
    business_id: business.id,
    status: 'trialing',
  });

  res.json({ business, ownerLogin: { email: ownerEmail, password: ownerPassword } });
});

// ── Update a client's business details (admin can edit anything) ──────
router.put('/clients/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Suspend / activate / cancel a client ───────────────────────────────
router.patch('/clients/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'trial', 'active', 'suspended', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Delete a client entirely (business + auth user) ────────────────────
router.delete('/clients/:id', async (req, res) => {
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('owner_user_id')
    .eq('id', req.params.id)
    .maybeSingle();

  await supabaseAdmin.from('businesses').delete().eq('id', req.params.id);

  if (business?.owner_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(business.owner_user_id).catch(() => {});
  }

  res.json({ ok: true });
});

// ── Reset a client's password (in case they're locked out) ────────────
router.post('/clients/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('owner_user_id')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!business?.owner_user_id) return res.status(404).json({ error: 'No owner account linked' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(business.owner_user_id, {
    password: newPassword,
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
