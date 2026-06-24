import { google } from 'googleapis';
import { DateTime } from 'luxon';
import { env } from '../config/env';
import type { Location } from '@platform/shared-types';

type LocationSchedule = Pick<
  Location,
  'calendar_id' | 'timezone' | 'open_time' | 'close_time' | 'days_open' | 'appointment_duration_min'
>;

function getCalendarClient() {
  let privateKey = (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  // Remove wrapping quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}






export async function getAvailableSlots(location: LocationSchedule, dateStr: string): Promise<string[]> {
  const timezone = location.timezone || 'America/New_York';
  const open_time = location.open_time || '09:00';
  const close_time = location.close_time || '17:00';

  // FIX 1: Foolproof parsing for days_open to strictly be numbers
  let parsedDays = location.days_open;
  if (typeof parsedDays === 'string') {
    try { parsedDays = JSON.parse(parsedDays); } catch (e) { parsedDays = [0, 1, 2, 3, 4, 5, 6]; }
  }
  const days_open = (Array.isArray(parsedDays) ? parsedDays : [0, 1, 2, 3, 4, 5, 6]).map(Number);

  // FIX 2: Explicitly cast duration to Number to prevent Luxon invalidation
  const appointment_duration_min = Number(location.appointment_duration_min) || 30;
  const calendar_id = location.calendar_id;

  if (!calendar_id) {
    return generateMockSlots(location, dateStr);
  }

  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });

  // FIX 3: Return empty array instead of throwing an error if the AI hallucinates a bad date format
  if (!dayStart.isValid) {
    console.error(`[Calendar] Invalid date format from AI: ${dateStr}`);
    return [];
  }

  const jsWeekday = dayStart.weekday % 7; // Maps 7 (Sun) to 0, 1 to 1, etc.
  if (!days_open.includes(jsWeekday)) {
    console.log(`[Calendar] No slots: Weekday ${jsWeekday} is not in days_open: [${days_open}]`);
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

  // FIX 4: Catch hidden Calendar permission errors
  const calendarErrors = fb.data.calendars?.[calendar_id]?.errors;
  if (calendarErrors) {
    console.error(`[Calendar API Error] The Service Account lacks permission to view ${calendar_id}:`, calendarErrors);
  }

  const busy = fb.data.calendars?.[calendar_id]?.busy || [];
  const now = DateTime.now();
  const slots: string[] = [];
  let cursor = dayStart;

  while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
    const slotEnd = cursor.plus({ minutes: appointment_duration_min });
    const overlaps = busy.some((b) => {
      const bs = DateTime.fromISO(b.start!);
      const be = DateTime.fromISO(b.end!);
      return cursor < be && slotEnd > bs;
    });
    if (!overlaps && cursor > now) slots.push(cursor.toISO()!);
    cursor = slotEnd;
  }

  console.log(`[Calendar] Generated ${slots.length} available slots for ${dateStr}`);
  return slots;
}

// Don't forget to fix the duration typing in your mock function as well!
function generateMockSlots(location: LocationSchedule, dateStr: string): string[] {
  const timezone = location.timezone || 'America/New_York';
  const open_time = location.open_time || '09:00';
  const close_time = location.close_time || '17:00';

  // FIX: Cast to number
  const appointment_duration_min = Number(location.appointment_duration_min) || 30;

  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });
  const now = DateTime.now();
  const slots: string[] = [];
  let cursor = dayStart;

  while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
    if (cursor > now) slots.push(cursor.toISO()!);
    cursor = cursor.plus({ minutes: appointment_duration_min });
  }
  return slots.filter((_, i) => i % 3 !== 1).slice(0, 6);
}


export async function createCalendarEvent(
  location: LocationSchedule,
  params: { summary: string; description: string; startISO: string },
) {
  const timezone = location.timezone || 'America/New_York';
  const appointment_duration_min = location.appointment_duration_min || 30;
  const calendar_id = location.calendar_id;

  if (!calendar_id) {
    const start = DateTime.fromISO(params.startISO, { zone: timezone });
    return {
      id: 'mock_' + Date.now(),
      start: { dateTime: start.toISO() },
      end: { dateTime: start.plus({ minutes: appointment_duration_min }).toISO() },
      summary: params.summary,
    };
  }

  const calendar = getCalendarClient();
  const start = DateTime.fromISO(params.startISO, { zone: timezone });
  const end = start.plus({ minutes: appointment_duration_min });

  const event = await calendar.events.insert({
    calendarId: calendar_id,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: start.toISO(), timeZone: timezone },
      end: { dateTime: end.toISO(), timeZone: timezone },
    },
  });
  return event.data;
}

export async function deleteCalendarEvent(
  location: LocationSchedule,
  calendarEventId: string | null,
): Promise<void> {
  if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
  if (!location.calendar_id) return;
  const calendar = getCalendarClient();
  await calendar.events
    .delete({ calendarId: location.calendar_id, eventId: calendarEventId })
    .catch(() => { });
}

export async function updateCalendarEventTime(
  location: LocationSchedule,
  calendarEventId: string,
  startISO: string,
): Promise<void> {
  if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
  if (!location.calendar_id) return;

  const timezone = location.timezone || 'America/New_York';
  const appointment_duration_min = location.appointment_duration_min || 30;

  const calendar = getCalendarClient();
  const start = DateTime.fromISO(startISO, { zone: timezone });
  const end = start.plus({ minutes: appointment_duration_min });

  await calendar.events.patch({
    calendarId: location.calendar_id,
    eventId: calendarEventId,
    requestBody: {
      start: { dateTime: start.toISO(), timeZone: location.timezone },
      end: { dateTime: end.toISO(), timeZone: location.timezone },
    },
  });
}
