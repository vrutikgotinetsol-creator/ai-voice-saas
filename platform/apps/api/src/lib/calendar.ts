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
  const days_open = location.days_open;
  const appointment_duration_min = location.appointment_duration_min || 30;
  const calendar_id = location.calendar_id;

  if (!calendar_id) {
    return generateMockSlots(location, dateStr);
  }

  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });
  if (!dayStart.isValid) throw new Error(`Invalid date: ${dateStr}`);

  const jsWeekday = dayStart.weekday % 7;
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
  return slots;
}

function generateMockSlots(location: LocationSchedule, dateStr: string): string[] {
  const timezone = location.timezone || 'America/New_York';
  const open_time = location.open_time || '09:00';
  const close_time = location.close_time || '17:00';
  const appointment_duration_min = location.appointment_duration_min || 30;
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
    .catch(() => {});
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
