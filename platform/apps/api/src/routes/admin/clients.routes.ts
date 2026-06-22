import { Router, Response } from 'express';
import { supabaseAdmin } from '../../lib/supabase';
import { encryptOptional } from '../../lib/encryption';
import { logAudit } from '../../services/audit.service';
import { requireAuth, requirePlatformAdmin, getAuthReq } from '../../middleware/auth';
import type { CreateClientRequest } from '@platform/shared-types';

const router = Router();
router.use(requireAuth, requirePlatformAdmin);

router.get('/clients', async (_req, res: Response) => {
  const { data: businesses, error } = await supabaseAdmin
    .from('businesses')
    .select('*, subscriptions(*, plans(*)), locations(*)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: apptCounts } = await supabaseAdmin.from('appointments').select('business_id, status');

  const counts: Record<string, { total: number; confirmed: number; cancelled: number }> = {};
  for (const row of apptCounts || []) {
    if (!counts[row.business_id]) counts[row.business_id] = { total: 0, confirmed: 0, cancelled: 0 };
    counts[row.business_id].total++;
    if (row.status === 'confirmed') counts[row.business_id].confirmed++;
    if (row.status === 'cancelled') counts[row.business_id].cancelled++;
  }

  res.json(
    (businesses || []).map((b) => ({
      ...b,
      appointment_stats: counts[b.id] || { total: 0, confirmed: 0, cancelled: 0 },
    })),
  );
});

router.get('/stats', async (_req, res: Response) => {
  const { data: businesses } = await supabaseAdmin.from('businesses').select('status');
  const { data: subs } = await supabaseAdmin.from('subscriptions').select('status, amount_cents');
  const { data: appts } = await supabaseAdmin
    .from('appointments')
    .select('id, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const { count: callCount } = await supabaseAdmin
    .from('call_logs')
    .select('*', { count: 'exact', head: true });
  const { count: bookedCount } = await supabaseAdmin
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('outcome', 'appointment_booked');

  const activeCount = (businesses || []).filter((b) => b.status === 'active').length;
  const trialCount = (businesses || []).filter((b) => b.status === 'trial').length;
  const suspendedCount = (businesses || []).filter((b) => b.status === 'suspended').length;
  const mrr =
    (subs || []).filter((s) => s.status === 'active').reduce((sum, s) => sum + (s.amount_cents || 0), 0) / 100;

  const totalCalls = callCount || 0;
  const aiBookingRate = totalCalls > 0 ? ((bookedCount || 0) / totalCalls) * 100 : 0;

  res.json({
    totalClients: (businesses || []).length,
    activeClients: activeCount,
    trialClients: trialCount,
    suspendedClients: suspendedCount,
    mrr,
    totalCalls,
    totalAppointments: (appts || []).length,
    aiBookingRate: Math.round(aiBookingRate * 10) / 10,
  });
});

router.get('/clients/:id', async (req, res: Response) => {
  const { data: business, error } = await supabaseAdmin
    .from('businesses')
    .select('*, subscriptions(*, plans(*)), services(*), faqs(*), locations(*)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!business) return res.status(404).json({ error: 'Client not found' });

  const [{ data: appointments }, { data: callLogs }, { data: leads }, { data: customers }] =
    await Promise.all([
      supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('business_id', req.params.id)
        .order('start_time', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('call_logs')
        .select('*')
        .eq('business_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('leads')
        .select('*')
        .eq('business_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('customers')
        .select('*')
        .eq('business_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  res.json({ ...business, appointments, callLogs, leads, customers });
});

router.post('/clients', async (req, res: Response) => {
  const body = req.body as CreateClientRequest;
  const authReq = getAuthReq(req);

  if (!body.ownerEmail || !body.ownerPassword || !body.name) {
    return res.status(400).json({ error: 'ownerEmail, ownerPassword, and name are required' });
  }

  const { data: plan } = body.planSlug
    ? await supabaseAdmin.from('plans').select('*').eq('slug', body.planSlug).maybeSingle()
    : await supabaseAdmin.from('plans').select('*').eq('slug', 'professional').maybeSingle();

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: body.ownerEmail,
    password: body.ownerPassword,
    email_confirm: true,
    user_metadata: { full_name: body.ownerName },
  });

  if (userError) return res.status(400).json({ error: `Could not create login: ${userError.message}` });

  const { data: business, error: bizError } = await supabaseAdmin
    .from('businesses')
    .insert({
      owner_user_id: userData.user.id,
      name: body.name,
      business_type: body.business_type,
      owner_name: body.ownerName,
      owner_email: body.ownerEmail,
      owner_phone: body.owner_phone,
      status: 'trial',
      trial_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (bizError) {
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    return res.status(400).json({ error: bizError.message });
  }

  if (body.location) {
    await supabaseAdmin.from('locations').insert({
      business_id: business.id,
      name: body.location.name || 'Main Location',
      address: body.location.address,
      timezone: body.location.timezone || 'America/New_York',
      vapi_phone_number_id: body.location.vapi_phone_number_id,
      vapi_phone_number_display: body.location.vapi_phone_number_display,
      twilio_account_sid_enc: encryptOptional(body.location.twilio_account_sid),
      twilio_auth_token_enc: encryptOptional(body.location.twilio_auth_token),
      twilio_sms_from: body.location.twilio_sms_from,
      calendar_id: body.location.calendar_id,
      is_primary: true,
    });
  }

  await supabaseAdmin.from('subscriptions').insert({
    business_id: business.id,
    plan_id: plan?.id,
    status: 'trialing',
    amount_cents: plan?.amount_cents || 19900,
  });

  await logAudit({
    actorUserId: authReq.user.id,
    actorType: 'platform_admin',
    action: 'client.created',
    resourceType: 'business',
    resourceId: business.id,
    businessId: business.id,
    metadata: { ownerEmail: body.ownerEmail, planSlug: body.planSlug },
    ipAddress: req.ip,
  });

  res.status(201).json({
    business,
    ownerLogin: { email: body.ownerEmail, password: body.ownerPassword },
  });
});

router.put('/clients/:id', async (req, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.patch('/clients/:id/status', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { status } = req.body;
  const valid = ['pending', 'trial', 'active', 'suspended', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { data, error } = await supabaseAdmin
    .from('businesses')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await logAudit({
    actorUserId: authReq.user.id,
    actorType: 'platform_admin',
    action: `client.status.${status}`,
    resourceType: 'business',
    resourceId: req.params.id,
    businessId: req.params.id,
    ipAddress: req.ip,
  });

  res.json(data);
});

router.delete('/clients/:id', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('owner_user_id')
    .eq('id', req.params.id)
    .maybeSingle();

  await supabaseAdmin.from('businesses').delete().eq('id', req.params.id);

  if (business?.owner_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(business.owner_user_id).catch(() => {});
  }

  await logAudit({
    actorUserId: authReq.user.id,
    actorType: 'platform_admin',
    action: 'client.deleted',
    resourceType: 'business',
    resourceId: req.params.id,
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

router.post('/clients/:id/reset-password', async (req, res: Response) => {
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

router.get('/stats/trends', async (_req, res: Response) => {
  const days = 30;
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [{ data: appts }, { data: calls }, { data: subs }] = await Promise.all([
    supabaseAdmin.from('appointments').select('created_at, price_label, status').gte('created_at', start.toISOString()),
    supabaseAdmin.from('call_logs').select('created_at').gte('created_at', start.toISOString()),
    supabaseAdmin.from('subscriptions').select('amount_cents, status, created_at').eq('status', 'active'),
  ]);

  const dateLabels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateLabels.push(d.toISOString().split('T')[0]);
  }

  const apptByDate: Record<string, number> = {};
  const callByDate: Record<string, number> = {};
  const revenueByDate: Record<string, number> = {};

  for (const a of appts || []) {
    const date = a.created_at.split('T')[0];
    apptByDate[date] = (apptByDate[date] || 0) + 1;
  }
  for (const c of calls || []) {
    const date = c.created_at.split('T')[0];
    callByDate[date] = (callByDate[date] || 0) + 1;
  }

  const activeMrr = (subs || []).reduce((sum, s) => sum + (s.amount_cents || 0), 0) / 100 / days;

  const trends = dateLabels.map((date) => ({
    date,
    appointments: apptByDate[date] || 0,
    calls: callByDate[date] || 0,
    revenue: Math.round(activeMrr * 100) / 100,
  }));

  res.json(trends);
});

router.get('/billing/overview', async (_req, res: Response) => {
  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('*, businesses(name), plans(name, slug)');

  const active = (subs || []).filter((s) => s.status === 'active');
  const pastDue = (subs || []).filter((s) => s.status === 'past_due');
  const trialing = (subs || []).filter((s) => s.status === 'trialing');
  const mrr = active.reduce((sum, s) => sum + (s.amount_cents || 0), 0) / 100;
  const canceled = (subs || []).filter((s) => s.status === 'canceled');

  res.json({
    activeSubscriptions: active.length,
    pastDueSubscriptions: pastDue.length,
    trialSubscriptions: trialing.length,
    monthlyRecurringRevenue: mrr,
    churnRate: subs?.length ? (canceled.length / subs.length) * 100 : 0,
    subscriptions: subs,
  });
});

export default router;
