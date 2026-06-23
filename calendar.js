const { google } = require('googleapis');
const { DateTime } = require('luxon');

function getCalendarClient() {
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  // Remove wrapping quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

/**
 * business is a row from the `businesses` table:
 * { timezone, open_time, close_time, days_open, appointment_duration_min, calendar_id }
 */
async function getAvailableSlots(business, dateStr) {
  const { calendar_id, timezone, open_time, close_time, days_open, appointment_duration_min } = business;

  if (!calendar_id) {
    return generateMockSlots(business, dateStr);
  }

  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });
  if (!dayStart.isValid) throw new Error(`Invalid date: ${dateStr}`);

  const jsWeekday = dayStart.weekday % 7; // Luxon 1=Mon..7=Sun -> JS 0=Sun..6=Sat
  if (!(days_open || [0, 1, 2, 3, 4, 5, 6]).includes(jsWeekday)) {
    return [];
  }

  const calendar = getCalendarClient();
  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toUTC().toISO(),
      timeMax: dayEnd.toUTC().toISO(),
      timeZone: timezone,
      items: [{ id: calendar_id }],
    },
  });

  const busy = fb.data.calendars?.[calendar_id]?.busy || [];
  const now = DateTime.now();
  const slots = [];
  let cursor = dayStart;

  while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
    const slotEnd = cursor.plus({ minutes: appointment_duration_min });
    const overlaps = busy.some((b) => {
      const bs = DateTime.fromISO(b.start);
      const be = DateTime.fromISO(b.end);
      return cursor < be && slotEnd > bs;
    });
    if (!overlaps && cursor > now) slots.push(cursor.toISO());
    cursor = slotEnd;
  }
  return slots;
}

function generateMockSlots(business, dateStr) {
  const { timezone, open_time, close_time, appointment_duration_min } = business;
  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });
  const now = DateTime.now();
  const slots = [];
  let cursor = dayStart;
  while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
    if (cursor > now) slots.push(cursor.toISO());
    cursor = cursor.plus({ minutes: appointment_duration_min });
  }
  return slots.filter((_, i) => i % 3 !== 1).slice(0, 6);
}

async function createCalendarEvent(business, { summary, description, startISO }) {
  const { calendar_id, timezone, appointment_duration_min } = business;

  if (!calendar_id) {
    const start = DateTime.fromISO(startISO, { zone: timezone });
    return {
      id: 'mock_' + Date.now(),
      start: { dateTime: start.toISO() },
      end: { dateTime: start.plus({ minutes: appointment_duration_min }).toISO() },
      summary,
    };
  }

  const calendar = getCalendarClient();
  const start = DateTime.fromISO(startISO, { zone: timezone });
  const end = start.plus({ minutes: appointment_duration_min });

  const event = await calendar.events.insert({
    calendarId: calendar_id,
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISO(), timeZone: timezone },
      end: { dateTime: end.toISO(), timeZone: timezone },
    },
  });
  return event.data;
}

async function deleteCalendarEvent(business, calendarEventId) {
  if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
  if (!business.calendar_id) return;
  const calendar = getCalendarClient();
  await calendar.events.delete({ calendarId: business.calendar_id, eventId: calendarEventId }).catch(() => {});
}

module.exports = { getAvailableSlots, createCalendarEvent, deleteCalendarEvent };
