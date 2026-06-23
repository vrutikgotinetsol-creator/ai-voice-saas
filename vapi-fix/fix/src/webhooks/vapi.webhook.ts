import { Request, Response, Router } from 'express';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '../lib/supabase';
import { buildSystemPrompt } from '../lib/prompt';
import { getAvailableSlots, createCalendarEvent, deleteCalendarEvent } from '../lib/calendar';

const router = Router();

// ─── Tool definitions sent to Vapi on every assistant-request ────────────────
function buildTools(toolUrl: string) {
  return [
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: 'Check available appointment slots for a given date.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format, e.g. 2026-06-25' },
          },
          required: ['date'],
        },
      },
      server: { url: toolUrl },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Book a confirmed appointment for the caller.',
        parameters: {
          type: 'object',
          properties: {
            customerName:  { type: 'string', description: 'Full name of the caller' },
            customerPhone: { type: 'string', description: 'Phone number of the caller' },
            service:       { type: 'string', description: 'Service being booked' },
            startTime:     { type: 'string', description: 'ISO 8601 start time, e.g. 2026-06-25T14:30:00' },
            notes:         { type: 'string', description: 'Any additional notes from the caller' },
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
        description: 'Cancel an existing confirmed appointment.',
        parameters: {
          type: 'object',
          properties: {
            customerName:  { type: 'string', description: 'Full name of the caller' },
            customerPhone: { type: 'string', description: 'Phone number of the caller' },
          },
          required: ['customerPhone'],
        },
      },
      server: { url: toolUrl },
    },
  ];
}

function fallbackAssistant() {
  return {
    assistant: {
      name: 'AI Receptionist',
      firstMessage: 'Hello, thanks for calling. We are getting set up — please try again shortly.',
      model: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'system', content: 'The business is not configured yet. Politely tell the caller someone will follow up and take their name and number.' }],
      },
      voice: { provider: 'vapi', voiceId: 'Elliot' },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /webhook/vapi  — main entry: assistant-request + tool-calls + end-of-call
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/vapi', async (req: Request, res: Response) => {
  const msg  = req.body?.message ?? req.body;
  const type = msg?.type;

  try {
    if (type === 'assistant-request')    return await handleAssistantRequest(req, res, msg);
    if (type === 'tool-calls')           return await handleToolCalls(req, res, msg, req.query.bid as string);
    if (type === 'end-of-call-report')   return await handleEndOfCall(res, msg);
    return res.json({ received: true });
  } catch (err: any) {
    console.error('[Vapi] Unhandled error:', err?.message);
    return res.status(200).json({ error: 'Internal error' });
  }
});

// Separate endpoint for tool calls (has ?bid= query param)
router.post('/vapi/tools', async (req: Request, res: Response) => {
  const msg = req.body?.message ?? req.body;
  try {
    return await handleToolCalls(req, res, msg, req.query.bid as string);
  } catch (err: any) {
    console.error('[Vapi tools] Error:', err?.message);
    return res.status(200).json({ error: 'Internal error' });
  }
});

// ─── assistant-request handler ───────────────────────────────────────────────
async function handleAssistantRequest(req: Request, res: Response, msg: any) {
  // Vapi sends phoneNumber.id — the Vapi phone number UUID
  const phoneNumberId =
    msg?.phoneNumber?.id ??
    msg?.call?.phoneNumberId ??
    msg?.phoneNumberId ??
    msg?.call?.phoneNumber?.id;

  console.log(`[Vapi] assistant-request | phoneNumberId: ${phoneNumberId}`);
  console.log(`[Vapi] msg keys: ${Object.keys(msg ?? {}).join(', ')}`);

  if (!phoneNumberId) {
    console.warn('[Vapi] No phoneNumberId in request — returning fallback');
    return res.json(fallbackAssistant());
  }

  // ── Look up the LOCATION that owns this Vapi phone number ──────────────────
  // Your schema: vapi_phone_number_id lives on the `locations` table
  const { data: location, error: locErr } = await supabaseAdmin
    .from('locations')
    .select('*, businesses(*)')
    .eq('vapi_phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();

  if (locErr || !location) {
    console.warn(`[Vapi] No active location for phoneNumberId: ${phoneNumberId}`, locErr?.message);
    return res.json(fallbackAssistant());
  }

  const business = location.businesses as any;

  if (!business) {
    console.warn(`[Vapi] Location found but no linked business`);
    return res.json(fallbackAssistant());
  }

  // ── Check business is active / on trial ───────────────────────────────────
  if (business.status === 'suspended' || business.status === 'cancelled') {
    return res.json({
      assistant: {
        name: 'AI Receptionist',
        firstMessage: `Thanks for calling ${business.name}. We're temporarily unable to take calls — please try again later.`,
        model: {
          provider: 'anthropic',
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'system', content: 'The business account is inactive. Politely tell the caller to try again later and take a message.' }],
        },
        voice: { provider: 'vapi', voiceId: business.voice_id || 'Elliot' },
      },
    });
  }

  // ── Fetch services + FAQs for this business ───────────────────────────────
  const [{ data: services }, { data: faqs }] = await Promise.all([
    supabaseAdmin
      .from('services')
      .select('name, price_label, duration_min')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('sort_order'),
    supabaseAdmin
      .from('faqs')
      .select('question, answer')
      .eq('business_id', business.id)
      .order('sort_order'),
  ]);

  const publicApiUrl = (process.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
  // Pass location.id so tool handler knows which calendar/hours to use
  const toolUrl = `${publicApiUrl}/webhook/vapi/tools?bid=${business.id}&lid=${location.id}`;

  const systemPrompt = buildSystemPrompt(business, location, services ?? [], faqs ?? []);

  console.log(`[Vapi] Serving assistant for: ${business.name} (${location.name})`);

  return res.json({
    assistant: {
      name: `${business.name} Receptionist`,
      firstMessage: `Thank you for calling ${business.name}. This is ${business.agent_name || 'Riya'}. How can I help you today?`,
      model: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'system', content: systemPrompt }],
        tools: buildTools(toolUrl),
        temperature: 0.3,
      },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
      voice: { provider: 'vapi', voiceId: business.voice_id || process.env.DEFAULT_VOICE_ID || 'Elliot' },
    },
  });
}

// ─── tool-calls handler ───────────────────────────────────────────────────────
async function handleToolCalls(req: Request, res: Response, msg: any, businessId: string) {
  const locationId = req.query.lid as string;

  // Fetch both business and location in one go
  const { data: location } = await supabaseAdmin
    .from('locations')
    .select('*, businesses(*)')
    .eq('id', locationId)
    .maybeSingle();

  const business = location?.businesses as any;
  const toolCalls = msg?.toolCallList ?? [];
  const results: any[] = [];

  for (const call of toolCalls) {
    let result: string;
    try {
      const args = typeof call.function?.arguments === 'string'
        ? JSON.parse(call.function.arguments)
        : call.function?.arguments ?? {};

      if (!business || !location) {
        result = 'Business not found. Tell the caller a staff member will follow up.';
      } else if (call.function?.name === 'check_availability') {
        result = await toolCheckAvailability(location, args);
      } else if (call.function?.name === 'book_appointment') {
        result = await toolBookAppointment(business, location, args);
      } else if (call.function?.name === 'cancel_appointment') {
        result = await toolCancelAppointment(business, location, args);
      } else {
        result = `Unknown tool: ${call.function?.name}`;
      }
    } catch (err: any) {
      console.error(`[Tool] ${call.function?.name} error:`, err?.message);
      result = 'Something went wrong. Please tell the caller to try again or call back.';
    }
    results.push({ toolCallId: call.id, result });
  }

  return res.json({ results });
}

async function toolCheckAvailability(location: any, args: any): Promise<string> {
  const slots = await getAvailableSlots(location, args.date);
  if (!slots.length) {
    return `No available slots on ${args.date}. Suggest checking the next business day.`;
  }
  const readable = slots.slice(0, 4)
    .map((iso: string) => DateTime.fromISO(iso, { zone: location.timezone }).toFormat('h:mm a'))
    .join(', ');
  const isoList = slots.slice(0, 4).join(' | ');
  return `Available times on ${args.date}: ${readable}. ISO values for booking: ${isoList}`;
}

async function toolBookAppointment(business: any, location: any, args: any): Promise<string> {
  // Look up price snapshot for this service
  const { data: svcRow } = await supabaseAdmin
    .from('services')
    .select('price_label')
    .eq('business_id', business.id)
    .ilike('name', `%${args.service}%`)
    .maybeSingle();

  // Create Google Calendar event
  const event = await createCalendarEvent(location, {
    summary: `${args.service} — ${args.customerName}`,
    description: `Booked by AI. Phone: ${args.customerPhone}${args.notes ? '. Notes: ' + args.notes : ''}`,
    startISO: args.startTime,
  });

  // Save appointment to Supabase
  const { error } = await supabaseAdmin
    .from('appointments')
    .insert({
      business_id:      business.id,
      location_id:      location.id,
      customer_name:    args.customerName,
      customer_phone:   args.customerPhone,
      service_name:     args.service,
      price_label:      svcRow?.price_label ?? null,
      start_time:       args.startTime,
      duration_minutes: location.appointment_duration_min,
      calendar_event_id: event.id,
      notes:            args.notes ?? '',
    });

  if (error) {
    console.error('[toolBookAppointment] DB insert error:', error.message);
    throw error;
  }

  const readableTime = DateTime.fromISO(args.startTime, { zone: location.timezone })
    .toLocaleString(DateTime.DATETIME_MED);

  return `Appointment confirmed! ${args.customerName} is booked for ${args.service} on ${readableTime}.`;
}

async function toolCancelAppointment(business: any, location: any, args: any): Promise<string> {
  const { data: candidates } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('business_id', business.id)
    .eq('location_id', location.id)
    .eq('status', 'confirmed')
    .or(`customer_phone.eq.${args.customerPhone}${args.customerName ? `,customer_name.ilike.%${args.customerName}%` : ''}`);

  const appt = (candidates ?? [])[0];
  if (!appt) {
    return `No confirmed appointment found for ${args.customerName || args.customerPhone}. Ask them to double-check their details.`;
  }

  await supabaseAdmin.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
  await deleteCalendarEvent(location, appt.calendar_event_id);

  const time = DateTime.fromISO(appt.start_time, { zone: location.timezone })
    .toLocaleString(DateTime.DATETIME_MED);

  return `Appointment for ${appt.customer_name} on ${time} has been cancelled.`;
}

// ─── end-of-call-report handler ───────────────────────────────────────────────
async function handleEndOfCall(res: Response, msg: any) {
  const phoneNumberId = msg?.call?.phoneNumberId;

  if (phoneNumberId) {
    const { data: location } = await supabaseAdmin
      .from('locations')
      .select('id, business_id')
      .eq('vapi_phone_number_id', phoneNumberId)
      .maybeSingle();

    if (location) {
      await supabaseAdmin.from('call_logs').insert({
        business_id:  location.business_id,
        location_id:  location.id,
        vapi_call_id: msg?.call?.id,
        duration_sec: msg?.durationSeconds ?? null,
        cost_usd:     msg?.cost ?? null,
        ended_reason: msg?.endedReason ?? null,
      }).catch(console.error);
    }
  }

  console.log(`[Vapi] Call ended: ${msg?.call?.id}, cost: $${msg?.cost ?? 0}`);
  return res.json({ received: true });
}

export default router;
