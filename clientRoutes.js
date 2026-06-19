const express = require('express');
const { requireAuth, requireBusinessOwner } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireBusinessOwner);

// NOTE: every query below uses req.supabase (the RLS-scoped client bound
// to the logged-in shop owner's JWT) — NOT supabaseAdmin. This means even
// if there's a bug in this code, the database itself prevents one client
// from ever reading another client's rows.

// ── My business details ────────────────────────────────────────────────
router.get('/me/business', async (req, res) => {
  const { data, error } = await req.supabase
    .from('businesses')
    .select('*, services(*), faqs(*), subscriptions(*)')
    .eq('id', req.businessId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Update my business details (NOT vapi_phone_number_id / twilio creds —
//    those are platform-admin-only fields, enforced by allowlist below) ──
router.put('/me/business', async (req, res) => {
  const allowedFields = [
    'name', 'business_type', 'address', 'timezone', 'hours_text', 'agent_name',
    'open_time', 'close_time', 'days_open', 'appointment_duration_min', 'extra_info',
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const { data, error } = await req.supabase
    .from('businesses')
    .update(updates)
    .eq('id', req.businessId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Services CRUD ───────────────────────────────────────────────────────
router.get('/me/services', async (req, res) => {
  const { data, error } = await req.supabase
    .from('services')
    .select('*')
    .eq('business_id', req.businessId)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/me/services', async (req, res) => {
  const { data, error } = await req.supabase
    .from('services')
    .insert({ ...req.body, business_id: req.businessId })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/me/services/:serviceId', async (req, res) => {
  const { data, error } = await req.supabase
    .from('services')
    .update(req.body)
    .eq('id', req.params.serviceId)
    .eq('business_id', req.businessId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/me/services/:serviceId', async (req, res) => {
  const { error } = await req.supabase
    .from('services')
    .delete()
    .eq('id', req.params.serviceId)
    .eq('business_id', req.businessId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ── FAQs CRUD ────────────────────────────────────────────────────────────
router.get('/me/faqs', async (req, res) => {
  const { data, error } = await req.supabase
    .from('faqs')
    .select('*')
    .eq('business_id', req.businessId)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/me/faqs', async (req, res) => {
  const { data, error } = await req.supabase
    .from('faqs')
    .insert({ ...req.body, business_id: req.businessId })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/me/faqs/:faqId', async (req, res) => {
  const { data, error } = await req.supabase
    .from('faqs')
    .update(req.body)
    .eq('id', req.params.faqId)
    .eq('business_id', req.businessId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/me/faqs/:faqId', async (req, res) => {
  const { error } = await req.supabase
    .from('faqs')
    .delete()
    .eq('id', req.params.faqId)
    .eq('business_id', req.businessId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ── My appointments (read + status update only — AI creates them) ──────
router.get('/me/appointments', async (req, res) => {
  let query = req.supabase
    .from('appointments')
    .select('*')
    .eq('business_id', req.businessId)
    .order('start_time', { ascending: false });

  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.date) query = query.gte('start_time', `${req.query.date}T00:00:00`).lt('start_time', `${req.query.date}T23:59:59`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/me/appointments/:apptId', async (req, res) => {
  const allowedStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
  if (req.body.status && !allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const { data, error } = await req.supabase
    .from('appointments')
    .update({ status: req.body.status })
    .eq('id', req.params.apptId)
    .eq('business_id', req.businessId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── My subscription / billing status ────────────────────────────────────
router.get('/me/subscription', async (req, res) => {
  const { data, error } = await req.supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', req.businessId)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Compute trial days remaining
  const { data: business } = await req.supabase
    .from('businesses')
    .select('trial_started_at, status')
    .eq('id', req.businessId)
    .single();

  let trialDaysLeft = null;
  if (business?.status === 'trial' && business?.trial_started_at) {
    const daysUsed = Math.floor((Date.now() - new Date(business.trial_started_at)) / 86400000);
    trialDaysLeft = Math.max(0, 15 - daysUsed);
  }

  res.json({ ...data, businessStatus: business?.status, trialDaysLeft });
});

module.exports = router;
