import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '../../lib/supabase';
import { buildSystemPrompt } from '../../lib/prompt';
import { getAvailableSlots, createCalendarEvent, deleteCalendarEvent } from '../../lib/calendar';
import { sendSms } from '../../lib/sms';
import { env } from '../../config/env';
import type { Business, LocationWithSecrets } from '@platform/shared-types';

const router = Router();

function buildTools(toolUrl: string) {
  return [
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: 'Check available appointment time slots for a given date.',
        parameters: {
          type: 'object',
          properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD format' } },
          required: ['date'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Book an appointment for the caller.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            service: { type: 'string' },
            startTime: { type: 'string', description: 'ISO 8601 start time' },
            notes: { type: 'string' },
          },
          required: ['customerName', 'customerPhone', 'service', 'startTime'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'cancel_appointment',
        description: 'Cancel an existing appointment for the caller.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
          },
          required: ['customerPhone'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'capture_lead',
        description: 'Capture caller info when they do not book an appointment.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['phone'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'lookup_customer',
        description: 'Look up a returning customer by phone number.',
        parameters: {
          type: 'object',
          properties: { phone: { type: 'string' } },
          required: ['phone'],
        },
      },
      server: { url: toolUrl },
    },
  ];
}

router.post('/vapi', async (req: Request, res: Response) => {

  console.log('[Vapi webhook raw]*********************************', JSON.stringify(req.body, null, 2));


  const msg = req.body?.message || req.body;
  const type = msg?.type;
  console.log("type", type);
  console.log('[Vapi webhook raw]*********************************');

  try {
    // if (type === 'assistant-request') return await handleAssistantRequest(req, res, msg);
    if (type === 'assistant.started') return await handleAssistantRequest(req, res, msg);
    if (type === 'tool-calls') return await handleToolCalls(req, res, msg);
    if (type === 'end-of-call-report') return await handleEndOfCall(req, res, msg);
    return res.json({ received: true });
  } catch (err) {
    console.error('[Vapi webhook error]', err);
    return res.status(200).json({ error: 'Internal error' });
  }
});

router.post('/vapi/tools', async (req: Request, res: Response) => {
  const msg = req.body?.message || req.body;
  try {
    return await handleToolCalls(req, res, msg);
  } catch (err) {
    console.error('[Vapi tools error]', err);
    return res.status(200).json({ error: 'Internal error' });
  }
});

router.get('/vapi', (_req, res) => {
  res.json({
    success: true,
    route: 'vapi'
  });
});

async function resolveLocationByPhone(phoneNumberId: string | undefined) {
  if (!phoneNumberId) return null;

  const { data: location } = await supabaseAdmin
    .from('locations')
    .select('*, businesses(*)')
    .eq('vapi_phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();

  return location;
}

async function handleAssistantRequest(req: Request, res: Response, msg: Record<string, unknown>) {

  const phoneNumberId =
    (msg?.phoneNumber as { id?: string })?.id ||
    (msg?.call as { phoneNumberId?: string; phoneNumber?: { id?: string } })?.phoneNumberId ||
    (msg?.call as { phoneNumber?: { id?: string } })?.phoneNumber?.id ||
    (msg?.phoneNumberId as string);

  console.log(`[Vapi] assistant-request | phoneNumberId: ${phoneNumberId}`);

  if (!phoneNumberId) {
    console.warn('[Vapi] No phoneNumberId found in request');
    return res.json(fallbackAssistant());
  }

  const location = await resolveLocationByPhone(phoneNumberId as string);
  if (!location) {
    console.warn(`[Vapi] No location matched for phoneNumberId: ${phoneNumberId}. Make sure this ID is in your 'locations' table.`);
    return res.json(fallbackAssistant());
  }

  const business = location.businesses as Business;
  if (!business) {
    console.warn(`[Vapi] Location ${location.id} has no associated business`);
    return res.json(fallbackAssistant());
  }
  if (business.status === 'suspended' || business.status === 'cancelled') {
    return res.json(inactiveAssistant());
  }

  const [{ data: services }, { data: faqs }] = await Promise.all([
    supabaseAdmin.from('services').select('*').eq('business_id', business.id).order('sort_order'),
    supabaseAdmin.from('faqs').select('*').eq('business_id', business.id).order('sort_order'),
  ]);

  let publicApiUrl = (env.PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!publicApiUrl || publicApiUrl.includes('localhost')) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    publicApiUrl = `${protocol}://${req.headers.host}`;
  }
  const toolUrl = `${publicApiUrl}/webhook/vapi/tools?bid=${business.id}&lid=${location.id}`;

  console.log('🔥🔥🔥 ASSISTANT REQUEST RECEIVED 🔥🔥🔥');

  return res.json({
    assistant: {
      name: `${business.name} Receptionist`,
      firstMessage: `Thank you for calling ${business.name}. This is ${business.agent_name || 'Riya'}. How can I help you today?`,
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        messages: [{ role: 'system', content: buildSystemPrompt(business, location, services || [], faqs || []) }],
        tools: buildTools(toolUrl),
        temperature: 0.3,
      },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
      voice: { provider: 'vapi', voiceId: business.voice_id || env.DEFAULT_VOICE_ID },
    },
  });
}

function fallbackAssistant() {
  return {
    assistant: {
      name: 'AI Receptionist',
      firstMessage: 'Hello, thanks for calling. We are getting set up — please try again shortly.',
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        messages: [{ role: 'system', content: 'Business not configured. Politely take name and number for follow-up.' }],
      },
      voice: { provider: 'vapi', voiceId: env.DEFAULT_VOICE_ID },
    },
  };
}

function inactiveAssistant() {
  return {
    assistant: {
      name: 'AI Receptionist',
      firstMessage: `Thanks for calling. We're temporarily unable to take calls — please try again later.`,
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        messages: [{ role: 'system', content: 'Account inactive. Politely tell caller to try again later.' }],
      },
      voice: { provider: 'vapi', voiceId: env.DEFAULT_VOICE_ID },
    },
  };
}

async function handleToolCalls(req: Request, res: Response, msg: Record<string, unknown>) {
  let businessId = req.query.bid as string;
  let locationId = req.query.lid as string;

  let business: any = null;
  let location: any = null;

  if (businessId && locationId) {
    const [{ data: b }, { data: l }] = await Promise.all([
      supabaseAdmin.from('businesses').select('*').eq('id', businessId).maybeSingle(),
      supabaseAdmin.from('locations').select('*').eq('id', locationId).maybeSingle(),
    ]);
    business = b;
    location = l;
  } else {
    const phoneNumberId = (msg?.call as { phoneNumberId?: string })?.phoneNumberId;
    if (phoneNumberId) {
      const loc = await resolveLocationByPhone(phoneNumberId);
      if (loc) {
        location = loc;
        business = loc.businesses;
      }
    }
  }

  const toolCalls = (msg?.toolCallList as Array<{ id: string; function?: { name?: string; arguments?: string | Record<string, unknown> } }>) || [];
  const results: { toolCallId: string; result: string }[] = [];

  console.log(`[Vapi] tool-calls | count: ${toolCalls.length} | businessId: ${businessId} | locationId: ${locationId}`);

  for (const call of toolCalls) {
    let result: string;
    try {
      const args =
        typeof call.function?.arguments === 'string'
          ? JSON.parse(call.function.arguments)
          : call.function?.arguments || {};

      if (!business || !location) {
        result = 'Business not found. Tell the caller a staff member will follow up.';
      } else if (call.function?.name === 'check_availability') {
        result = await toolCheckAvailability(location, args);
      } else if (call.function?.name === 'book_appointment') {
        result = await toolBookAppointment(business, location as LocationWithSecrets, args);
      } else if (call.function?.name === 'cancel_appointment') {
        result = await toolCancelAppointment(business, location, args);
      } else if (call.function?.name === 'capture_lead') {
        result = await toolCaptureLead(business, location, args);
      } else if (call.function?.name === 'lookup_customer') {
        result = await toolLookupCustomer(business, args);
      } else {
        result = `Unknown tool: ${call.function?.name}`;
      }
    } catch (err) {
      console.error('[Tool call error]', call.function?.name, err);
      result = 'Something went wrong. Ask the caller to try again or call back.';
    }
    results.push({ toolCallId: call.id, result });
  }

  return res.json({ results });
}

async function toolCheckAvailability(location: LocationWithSecrets, args: { date: string }) {
  const slots = await getAvailableSlots(location, args.date);
  if (slots.length === 0) {
    return `No slots available on ${args.date}. Suggest checking the next business day.`;
  }
  const timezone = location.timezone || 'America/New_York';
  const readable = slots.slice(0, 4).map((iso) =>
    DateTime.fromISO(iso, { zone: timezone }).toFormat('h:mm a'),
  ).join(', ');
  const isoList = slots.slice(0, 4).join(' | ');
  return `Available times on ${args.date}: ${readable}. ISO values for booking: ${isoList}`;
}

async function toolBookAppointment(
  business: Business,
  location: LocationWithSecrets,
  args: { customerName: string; customerPhone: string; service: string; startTime: string; notes?: string },
) {
  const { data: serviceRow } = await supabaseAdmin
    .from('services')
    .select('price_label')
    .eq('business_id', business.id)
    .ilike('name', args.service)
    .maybeSingle();

  const event = await createCalendarEvent(location, {
    summary: `${args.service} – ${args.customerName}`,
    description: `Booked by AI. Customer: ${args.customerName}, Phone: ${args.customerPhone}`,
    startISO: args.startTime,
  });

  const { error } = await supabaseAdmin.from('appointments').insert({
    business_id: business.id,
    location_id: location.id,
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    service_name: args.service,
    price_label: serviceRow?.price_label || null,
    start_time: args.startTime,
    duration_minutes: location.appointment_duration_min,
    calendar_event_id: event.id,
    notes: args.notes || '',
  });

  if (error) throw error;

  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('business_id', business.id)
    .eq('customer_phone', args.customerPhone)
    .eq('start_time', args.startTime)
    .maybeSingle();

  if (appt) {
    await sendSms({ ...location, name: business.name }, appt, 'confirmation').catch(console.error);
    await supabaseAdmin.from('appointments').update({ confirmation_sms_sent: true }).eq('id', appt.id);
  }

  const timezone = location.timezone || 'America/New_York';
  const readableTime = DateTime.fromISO(args.startTime, { zone: timezone }).toLocaleString(
    DateTime.DATETIME_MED,
  );
  return `Appointment confirmed! ${args.customerName} is booked for ${args.service} on ${readableTime}.`;
}

async function toolCancelAppointment(
  business: Business,
  location: LocationWithSecrets,
  args: { customerPhone: string; customerName?: string },
) {
  let query = supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'confirmed')
    .eq('customer_phone', args.customerPhone);

  const { data: candidates } = await query;
  const appt = (candidates || [])[0];

  if (!appt) {
    return `No confirmed appointment found for ${args.customerName || args.customerPhone}. Ask them to double-check.`;
  }

  await supabaseAdmin.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
  await deleteCalendarEvent(location, appt.calendar_event_id);
  await sendSms({ ...location, name: business.name }, appt, 'cancellation').catch(console.error);

  const timezone = location.timezone || 'America/New_York';
  const time = DateTime.fromISO(appt.start_time, { zone: timezone }).toLocaleString(DateTime.DATETIME_MED);
  return `Appointment for ${appt.customer_name} on ${time} has been cancelled.`;
}

async function toolCaptureLead(
  business: Business,
  location: LocationWithSecrets,
  args: { name?: string; phone: string; reason?: string },
) {
  await supabaseAdmin.from('leads').insert({
    business_id: business.id,
    location_id: location.id,
    name: args.name || null,
    phone: args.phone,
    call_reason: args.reason || null,
    follow_up_required: true,
    status: 'new',
  });
  return `Lead captured for ${args.name || args.phone}. Tell the caller someone will follow up soon.`;
}

async function toolLookupCustomer(business: Business, args: { phone: string }) {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('business_id', business.id)
    .eq('phone', args.phone)
    .maybeSingle();

  if (!customer) return 'No previous record found for this phone number.';

  const lastVisit = customer.last_visit_at
    ? DateTime.fromISO(customer.last_visit_at).toLocaleString(DateTime.DATE_MED)
    : 'never';

  return `Returning customer: ${customer.name}. Total visits: ${customer.total_appointments}. Last visit: ${lastVisit}.`;
}

async function handleEndOfCall(_req: Request, res: Response, msg: Record<string, unknown>) {
  const phoneNumberId = (msg?.call as { phoneNumberId?: string })?.phoneNumberId;
  const call = msg?.call as { id?: string; customer?: { number?: string } } | undefined;

  let locationId: string | null = null;
  let businessId: string | null = null;

  if (phoneNumberId) {
    const location = await resolveLocationByPhone(phoneNumberId);
    if (location) {
      locationId = location.id;
      businessId = location.business_id;
    }
  }

  if (businessId) {
    const { data: callLog } = await supabaseAdmin
      .from('call_logs')
      .insert({
        business_id: businessId,
        location_id: locationId,
        vapi_call_id: call?.id,
        customer_phone: call?.customer?.number,
        duration_sec: (msg?.durationSeconds as number) || null,
        cost_usd: (msg?.cost as number) || null,
        ended_reason: (msg?.endedReason as string) || null,
        summary: (msg?.summary as string) || null,
      })
      .select()
      .single();

    const transcript = (msg?.transcript as string) || (msg?.artifact as { transcript?: string })?.transcript;
    if (callLog && transcript) {
      await supabaseAdmin.from('call_transcripts').insert({
        call_log_id: callLog.id,
        transcript,
      });
    }
  }

  console.log(`[Vapi] Call ended: ${call?.id}, cost: $${(msg?.cost as number) || 0}`);
  return res.json({ received: true });
}

export default router;
