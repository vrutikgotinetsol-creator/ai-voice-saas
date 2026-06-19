import { Router, Response } from 'express';
import { requireAuth, requireBusinessOwner, getAuthReq } from '../../middleware/auth';
import { rescheduleAppointment } from '../../services/appointment.service';
import { env } from '../../config/env';

const router = Router();
router.use(requireAuth, requireBusinessOwner);

// ── Business profile (no secrets exposed) ────────────────────────────────
router.get('/me/business', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('businesses')
    .select('*, services(*), faqs(*), subscriptions(*, plans(*)), locations(id, name, address, timezone, hours_text, open_time, close_time, days_open, appointment_duration_min, vapi_phone_number_display, is_primary, is_active)')
    .eq('id', authReq.businessId!)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/me/business', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const allowedFields = [
    'name', 'business_type', 'address', 'timezone', 'agent_name', 'extra_info', 'owner_phone',
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const { data, error } = await authReq.supabase
    .from('businesses')
    .update(updates)
    .eq('id', authReq.businessId!)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Services CRUD ────────────────────────────────────────────────────────
router.get('/me/services', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('services')
    .select('*')
    .eq('business_id', authReq.businessId!)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/me/services', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('services')
    .insert({ ...req.body, business_id: authReq.businessId })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/me/services/:serviceId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('services')
    .update(req.body)
    .eq('id', req.params.serviceId)
    .eq('business_id', authReq.businessId!)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/me/services/:serviceId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { error } = await authReq.supabase
    .from('services')
    .delete()
    .eq('id', req.params.serviceId)
    .eq('business_id', authReq.businessId!);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ── FAQs CRUD ────────────────────────────────────────────────────────────
router.get('/me/faqs', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('faqs')
    .select('*')
    .eq('business_id', authReq.businessId!)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/me/faqs', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('faqs')
    .insert({ ...req.body, business_id: authReq.businessId })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/me/faqs/:faqId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('faqs')
    .update(req.body)
    .eq('id', req.params.faqId)
    .eq('business_id', authReq.businessId!)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/me/faqs/:faqId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { error } = await authReq.supabase
    .from('faqs')
    .delete()
    .eq('id', req.params.faqId)
    .eq('business_id', authReq.businessId!);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ── Appointments ─────────────────────────────────────────────────────────
router.get('/me/appointments', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  let query = authReq.supabase
    .from('appointments')
    .select('*')
    .eq('business_id', authReq.businessId!)
    .order('start_time', { ascending: false });

  if (req.query.status) query = query.eq('status', req.query.status as string);
  if (req.query.date) {
    query = query
      .gte('start_time', `${req.query.date}T00:00:00`)
      .lt('start_time', `${req.query.date}T23:59:59`);
  }
  if (req.query.search) {
    const s = req.query.search as string;
    query = query.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/me/appointments/:apptId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const allowedStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
  if (req.body.status && !allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (req.body.start_time) {
    const { error } = await rescheduleAppointment(
      authReq.businessId!,
      req.params.apptId,
      req.body.start_time,
    );
    if (error) return res.status(400).json({ error });
    if (!req.body.status) {
      const { data } = await authReq.supabase
        .from('appointments')
        .select('*')
        .eq('id', req.params.apptId)
        .single();
      return res.json(data);
    }
  }

  const { data, error } = await authReq.supabase
    .from('appointments')
    .update({ status: req.body.status })
    .eq('id', req.params.apptId)
    .eq('business_id', authReq.businessId!)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Customers ────────────────────────────────────────────────────────────
router.get('/me/customers', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  let query = authReq.supabase
    .from('customers')
    .select('*')
    .eq('business_id', authReq.businessId!)
    .order('created_at', { ascending: false });

  if (req.query.search) {
    const s = req.query.search as string;
    query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/me/customers/:customerId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data: customer, error } = await authReq.supabase
    .from('customers')
    .select('*')
    .eq('id', req.params.customerId)
    .eq('business_id', authReq.businessId!)
    .single();

  if (error) return res.status(404).json({ error: 'Customer not found' });

  const { data: appointments } = await authReq.supabase
    .from('appointments')
    .select('*')
    .eq('customer_id', req.params.customerId)
    .order('start_time', { ascending: false });

  res.json({ ...customer, appointments });
});

router.put('/me/customers/:customerId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const allowed = ['name', 'phone', 'email', 'notes'];
  const updates: Record<string, unknown> = {};
  for (const f of allowed) if (f in req.body) updates[f] = req.body[f];

  const { data, error } = await authReq.supabase
    .from('customers')
    .update(updates)
    .eq('id', req.params.customerId)
    .eq('business_id', authReq.businessId!)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Leads ────────────────────────────────────────────────────────────────
router.get('/me/leads', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  let query = authReq.supabase
    .from('leads')
    .select('*')
    .eq('business_id', authReq.businessId!)
    .order('created_at', { ascending: false });

  if (req.query.status) query = query.eq('status', req.query.status as string);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/me/leads/:leadId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const allowed = ['status', 'notes', 'follow_up_required'];
  const updates: Record<string, unknown> = {};
  for (const f of allowed) if (f in req.body) updates[f] = req.body[f];

  const { data, error } = await authReq.supabase
    .from('leads')
    .update(updates)
    .eq('id', req.params.leadId)
    .eq('business_id', authReq.businessId!)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Call logs ──────────────────────────────────────────────────────────────
router.get('/me/calls', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('call_logs')
    .select('id, business_id, duration_sec, outcome, summary, sentiment, customer_phone, created_at')
    .eq('business_id', authReq.businessId!)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Location hours (no secrets) ──────────────────────────────────────────
router.put('/me/locations/:locationId', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const allowed = ['name', 'address', 'hours_text', 'open_time', 'close_time', 'days_open', 'timezone'];
  const updates: Record<string, unknown> = {};
  for (const f of allowed) if (f in req.body) updates[f] = req.body[f];

  const { data, error } = await authReq.supabase
    .from('locations')
    .update(updates)
    .eq('id', req.params.locationId)
    .eq('business_id', authReq.businessId!)
    .select('id, name, address, timezone, hours_text, open_time, close_time, days_open, is_primary')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Dashboard stats ──────────────────────────────────────────────────────
router.get('/me/stats', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const today = new Date().toISOString().split('T')[0];

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ count: apptsToday }, { count: callsToday }, { data: upcoming }, { count: monthAppts }, { data: monthCompleted }] =
    await Promise.all([
    authReq.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', authReq.businessId!)
      .gte('start_time', `${today}T00:00:00`)
      .lt('start_time', `${today}T23:59:59`),
    authReq.supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', authReq.businessId!)
      .gte('created_at', `${today}T00:00:00`),
    authReq.supabase
      .from('appointments')
      .select('*')
      .eq('business_id', authReq.businessId!)
      .eq('status', 'confirmed')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5),
    authReq.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', authReq.businessId!)
      .gte('start_time', monthStart.toISOString()),
    authReq.supabase
      .from('appointments')
      .select('price_label')
      .eq('business_id', authReq.businessId!)
      .eq('status', 'completed')
      .gte('start_time', monthStart.toISOString()),
  ]);

  let revenueTodayCents = 0;
  let revenueMonthCents = 0;
  const todayStr = today;

  for (const a of monthCompleted || []) {
    const cents = parsePriceLabel(a.price_label);
    revenueMonthCents += cents;
  }

  const { data: todayCompleted } = await authReq.supabase
    .from('appointments')
    .select('price_label, start_time')
    .eq('business_id', authReq.businessId!)
    .eq('status', 'completed')
    .gte('start_time', `${todayStr}T00:00:00`)
    .lt('start_time', `${todayStr}T23:59:59`);

  for (const a of todayCompleted || []) {
    revenueTodayCents += parsePriceLabel(a.price_label);
  }

  res.json({
    appointmentsToday: apptsToday || 0,
    callsToday: callsToday || 0,
    revenueTodayCents,
    revenueMonthCents,
    appointmentsThisMonth: monthAppts || 0,
    upcomingAppointments: upcoming || [],
  });
});

function parsePriceLabel(label: string | null): number {
  if (!label) return 0;
  const num = parseFloat(label.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

router.get('/me/stats/trends', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const days = 30;
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [{ data: appts }, { data: calls }] = await Promise.all([
    authReq.supabase
      .from('appointments')
      .select('start_time, price_label, status, created_at')
      .eq('business_id', authReq.businessId!)
      .gte('created_at', start.toISOString()),
    authReq.supabase
      .from('call_logs')
      .select('created_at')
      .eq('business_id', authReq.businessId!)
      .gte('created_at', start.toISOString()),
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
    if (a.status === 'completed') {
      revenueByDate[date] = (revenueByDate[date] || 0) + parsePriceLabel(a.price_label);
    }
  }
  for (const c of calls || []) {
    const date = c.created_at.split('T')[0];
    callByDate[date] = (callByDate[date] || 0) + 1;
  }

  res.json(
    dateLabels.map((date) => ({
      date,
      appointments: apptByDate[date] || 0,
      calls: callByDate[date] || 0,
      revenue: (revenueByDate[date] || 0) / 100,
    })),
  );
});

router.get('/me/analytics', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const monthStart = new Date();
  monthStart.setDate(1);

  const [{ data: calls }, { count: bookings }, { count: cancellations }] = await Promise.all([
    authReq.supabase
      .from('call_logs')
      .select('duration_sec, outcome, created_at')
      .eq('business_id', authReq.businessId!)
      .gte('created_at', monthStart.toISOString()),
    authReq.supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', authReq.businessId!)
      .eq('outcome', 'appointment_booked')
      .gte('created_at', monthStart.toISOString()),
    authReq.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', authReq.businessId!)
      .eq('status', 'cancelled')
      .gte('created_at', monthStart.toISOString()),
  ]);

  const callList = calls || [];
  const totalCalls = callList.length;
  const callsAnswered = callList.filter((c) => (c.duration_sec ?? 0) > 0).length;
  const callsMissed = totalCalls - callsAnswered;
  const totalDuration = callList.reduce((s, c) => s + (c.duration_sec ?? 0), 0);
  const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  const conversionRate = totalCalls > 0 ? Math.round(((bookings || 0) / totalCalls) * 1000) / 10 : 0;

  res.json({
    callsAnswered,
    callsMissed,
    bookings: bookings || 0,
    cancellations: cancellations || 0,
    conversionRate,
    avgCallDurationSec: avgDuration,
    totalCalls,
  });
});

// ── Subscription ─────────────────────────────────────────────────────────
router.get('/me/subscription', async (req, res: Response) => {
  const authReq = getAuthReq(req);
  const { data, error } = await authReq.supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('business_id', authReq.businessId!)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { data: business } = await authReq.supabase
    .from('businesses')
    .select('trial_started_at, status')
    .eq('id', authReq.businessId!)
    .single();

  let trialDaysLeft: number | null = null;
  if (business?.status === 'trial' && business?.trial_started_at) {
    const daysUsed = Math.floor((Date.now() - new Date(business.trial_started_at).getTime()) / 86400000);
    trialDaysLeft = Math.max(0, env.TRIAL_DAYS - daysUsed);
  }

  res.json({ ...data, businessStatus: business?.status, trialDaysLeft });
});

export default router;
