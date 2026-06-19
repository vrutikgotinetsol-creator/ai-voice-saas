const express = require('express');
const { DateTime } = require('luxon');
const { supabaseAdmin } = require('../lib/supabase');
const { buildSystemPrompt } = require('../lib/prompt');
const { getAvailableSlots, createCalendarEvent, deleteCalendarEvent } = require('../lib/calendar');

const router = express.Router();

function buildTools(toolUrl) {
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
            customerName: { type: 'string', description: 'Full name of the caller' },
            customerPhone: { type: 'string', description: 'Phone number of the caller' },
            service: { type: 'string', description: 'Service being booked' },
            startTime: { type: 'string', description: 'ISO 8601 start time chosen by caller' },
            notes: { type: 'string', description: 'Any additional notes' },
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
            customerName: { type: 'string', description: 'Full name of the caller' },
            customerPhone: { type: 'string', description: 'Phone number of the caller' },
          },
          required: ['customerPhone'],
        },
      },
      server: { url: toolUrl },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// POST /webhook/vapi — assistant-request, tool-calls, end-of-call-report
// ═══════════════════════════════════════════════════════════════════════
router.post('/vapi', async (req, res) => {
  const msg = req.body?.message || req.body;
  const type = msg?.type;

  try {
    if (type === 'assistant-request') return await handleAssistantRequest(req, res, msg);
    if (type === 'tool-calls') return await handleToolCalls(req, res, msg, req.query.bid);
    if (type === 'end-of-call-report') return await handleEndOfCall(req, res, msg);
    return res.json({ received: true });
  } catch (err) {
    console.error('[Vapi webhook error]', err);
    return res.status(200).json({ error: 'Internal error' });
  }
});

// Separate path for tool calls (keeps query param routing explicit)
router.post('/vapi/tools', async (req, res) => {
  const msg = req.body?.message || req.body;
  try {
    return await handleToolCalls(req, res, msg, req.query.bid);
  } catch (err) {
    console.error('[Vapi tools error]', err);
    return res.status(200).json({ error: 'Internal error' });
  }
});

async function handleAssistantRequest(req, res, msg) {
  const phoneNumberId =
    msg?.phoneNumber?.id || msg?.call?.phoneNumberId || msg?.phoneNumberId || msg?.call?.phoneNumber?.id;

  console.log(`[Vapi] assistant-request | phoneNumberId: ${phoneNumberId}`);

  if (!phoneNumberId) {
    return res.json(fallbackAssistant());
  }

  const { data: business, error } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .eq('vapi_phone_number_id', phoneNumberId)
    .maybeSingle();

  if (error || !business) {
    console.warn(`[Vapi] No business matched for phoneNumberId: ${phoneNumberId}`);
    return res.json(fallbackAssistant());
  }

  if (business.status === 'suspended' || business.status === 'cancelled') {
    return res.json({
      assistant: {
        name: 'AI Receptionist',
        firstMessage: `Thanks for calling. We're temporarily unable to take calls — please try again later.`,
        model: {
          provider: 'anthropic',
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'system', content: 'The business account is inactive. Politely tell the caller to try again later and take a message.' }],
        },
        voice: { provider: 'vapi', voiceId: 'Elliot' },
      },
    });
  }

  const [{ data: services }, { data: faqs }] = await Promise.all([
    supabaseAdmin.from('services').select('*').eq('business_id', business.id).order('sort_order'),
    supabaseAdmin.from('faqs').select('*').eq('business_id', business.id).order('sort_order'),
  ]);

  const publicApiUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  const toolUrl = `${publicApiUrl}/webhook/vapi/tools?bid=${business.id}`;

  return res.json({
    assistant: {
      name: `${business.name} Receptionist`,
      firstMessage: `Thank you for calling ${business.name}. This is ${business.agent_name || 'Riya'}. How can I help you today?`,
      model: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'system', content: buildSystemPrompt(business, services, faqs) }],
        tools: buildTools(toolUrl),
        temperature: 0.3,
      },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
      voice: { provider: 'vapi', voiceId: business.voice_id || process.env.DEFAULT_VOICE_ID || 'Elliot' },
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
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'system', content: 'The business is not configured yet. Politely tell the caller someone will follow up, and take their name and number.' }],
      },
      voice: { provider: 'vapi', voiceId: 'Elliot' },
    },
  };
}

async function handleToolCalls(req, res, msg, businessId) {
  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle();

  const toolCalls = msg?.toolCallList || [];
  const results = [];

  for (const call of toolCalls) {
    let result;
    try {
      const args = typeof call.function?.arguments === 'string'
        ? JSON.parse(call.function.arguments)
        : call.function?.arguments || {};

      if (!business) {
        result = 'Business not found. Tell the caller a staff member will follow up.';
      } else if (call.function?.name === 'check_availability') {
        result = await toolCheckAvailability(business, args);
      } else if (call.function?.name === 'book_appointment') {
        result = await toolBookAppointment(business, args);
      } else if (call.function?.name === 'cancel_appointment') {
        result = await toolCancelAppointment(business, args);
      } else {
        result = `Unknown tool: ${call.function?.name}`;
      }
    } catch (err) {
      console.error('[Tool call error]', call.function?.name, err.message);
      result = 'Something went wrong. Please tell the caller to try again or call back.';
    }
    results.push({ toolCallId: call.id, result });
  }

  return res.json({ results });
}

async function toolCheckAvailability(business, args) {
  const slots = await getAvailableSlots(business, args.date);
  if (slots.length === 0) {
    return `No slots available on ${args.date}. Suggest checking the next business day.`;
  }
  const readable = slots.slice(0, 4).map((iso) =>
    DateTime.fromISO(iso, { zone: business.timezone }).toFormat('h:mm a')
  ).join(', ');
  const isoList = slots.slice(0, 4).join(' | ');
  return `Available times on ${args.date}: ${readable}. ISO values for booking: ${isoList}`;
}

async function toolBookAppointment(business, args) {
  // Look up the price for this service, if configured
  const { data: serviceRow } = await supabaseAdmin
    .from('services')
    .select('price_label')
    .eq('business_id', business.id)
    .ilike('name', args.service)
    .maybeSingle();

  const event = await createCalendarEvent(business, {
    summary: `${args.service} – ${args.customerName}`,
    description: `Booked by AI. Customer: ${args.customerName}, Phone: ${args.customerPhone}`,
    startISO: args.startTime,
  });

  const { data: appt, error } = await supabaseAdmin
    .from('appointments')
    .insert({
      business_id: business.id,
      customer_name: args.customerName,
      customer_phone: args.customerPhone,
      service_name: args.service,
      price_label: serviceRow?.price_label || null,
      start_time: args.startTime,
      duration_minutes: business.appointment_duration_min,
      calendar_event_id: event.id,
      notes: args.notes || '',
    })
    .select()
    .single();

  if (error) throw error;

  const readableTime = DateTime.fromISO(args.startTime, { zone: business.timezone })
    .toLocaleString(DateTime.DATETIME_MED);

  return `Appointment confirmed! ${args.customerName} is booked for ${args.service} on ${readableTime}.`;
}

async function toolCancelAppointment(business, args) {
  const { data: candidates } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'confirmed')
    .or(`customer_phone.eq.${args.customerPhone}${args.customerName ? `,customer_name.ilike.${args.customerName}` : ''}`);

  const appt = (candidates || [])[0];
  if (!appt) {
    return `No confirmed appointment found for ${args.customerName || args.customerPhone}. Ask the caller to double-check their details.`;
  }

  await supabaseAdmin.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
  await deleteCalendarEvent(business, appt.calendar_event_id);

  const time = DateTime.fromISO(appt.start_time, { zone: business.timezone }).toLocaleString(DateTime.DATETIME_MED);
  return `Appointment for ${appt.customer_name} on ${time} has been cancelled.`;
}

async function handleEndOfCall(req, res, msg) {
  const phoneNumberId = msg?.call?.phoneNumberId;
  let businessId = null;

  if (phoneNumberId) {
    const { data } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('vapi_phone_number_id', phoneNumberId)
      .maybeSingle();
    businessId = data?.id || null;
  }

  if (businessId) {
    await supabaseAdmin.from('call_logs').insert({
      business_id: businessId,
      vapi_call_id: msg?.call?.id,
      duration_sec: msg?.durationSeconds || null,
      cost_usd: msg?.cost || null,
      ended_reason: msg?.endedReason || null,
    });
  }

  console.log(`[Vapi] Call ended: ${msg?.call?.id}, cost: $${msg?.cost || 0}`);
  return res.json({ received: true });
}

module.exports = router;
