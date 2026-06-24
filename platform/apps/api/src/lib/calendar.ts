// import { google } from 'googleapis';
// import { DateTime } from 'luxon';
// import { env } from '../config/env';
// import type { Location } from '@platform/shared-types';

// type LocationSchedule = Pick<
//   Location,
//   'calendar_id' | 'timezone' | 'open_time' | 'close_time' | 'days_open' | 'appointment_duration_min'
// >;

// function getCalendarClient() {
//   let privateKey = (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

//   // Remove wrapping quotes if present
//   if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
//     privateKey = privateKey.substring(1, privateKey.length - 1);
//   } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
//     privateKey = privateKey.substring(1, privateKey.length - 1);
//   }

//   const auth = new google.auth.GoogleAuth({
//     credentials: {
//       client_email: env.GOOGLE_CLIENT_EMAIL,
//       private_key: privateKey,
//     },
//     scopes: ['https://www.googleapis.com/auth/calendar'],
//   });
//   return google.calendar({ version: 'v3', auth });
// }






// export async function getAvailableSlots(location: LocationSchedule, dateStr: string): Promise<string[]> {
//   const timezone = location.timezone || 'America/New_York';
//   const open_time = location.open_time || '09:00';
//   const close_time = location.close_time || '17:00';

//   // FIX 1: Foolproof parsing for days_open to strictly be numbers
//   let parsedDays = location.days_open;
//   if (typeof parsedDays === 'string') {
//     try { parsedDays = JSON.parse(parsedDays); } catch (e) { parsedDays = [0, 1, 2, 3, 4, 5, 6]; }
//   }
//   const days_open = (Array.isArray(parsedDays) ? parsedDays : [0, 1, 2, 3, 4, 5, 6]).map(Number);

//   // FIX 2: Explicitly cast duration to Number to prevent Luxon invalidation
//   const appointment_duration_min = Number(location.appointment_duration_min) || 30;
//   const calendar_id = location.calendar_id;

//   if (!calendar_id) {
//     return generateMockSlots(location, dateStr);
//   }

//   const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
//   const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });

//   // FIX 3: Return empty array instead of throwing an error if the AI hallucinates a bad date format
//   if (!dayStart.isValid) {
//     console.error(`[Calendar] Invalid date format from AI: ${dateStr}`);
//     return [];
//   }

//   const jsWeekday = dayStart.weekday % 7; // Maps 7 (Sun) to 0, 1 to 1, etc.
//   if (!days_open.includes(jsWeekday)) {
//     console.log(`[Calendar] No slots: Weekday ${jsWeekday} is not in days_open: [${days_open}]`);
//     return [];
//   }

//   const calendar = getCalendarClient();
//   const fb = await calendar.freebusy.query({
//     requestBody: {
//       timeMin: dayStart.toUTC().toISO(),
//       timeMax: dayEnd.toUTC().toISO(),
//       timeZone: timezone,
//       items: [{ id: calendar_id }],
//     },
//   });

//   // FIX 4: Catch hidden Calendar permission errors
//   const calendarErrors = fb.data.calendars?.[calendar_id]?.errors;
//   if (calendarErrors) {
//     console.error(`[Calendar API Error] The Service Account lacks permission to view ${calendar_id}:`, calendarErrors);
//   }

//   const busy = fb.data.calendars?.[calendar_id]?.busy || [];
//   const now = DateTime.now();
//   const slots: string[] = [];
//   let cursor = dayStart;

//   while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
//     const slotEnd = cursor.plus({ minutes: appointment_duration_min });
//     const overlaps = busy.some((b) => {
//       const bs = DateTime.fromISO(b.start!);
//       const be = DateTime.fromISO(b.end!);
//       return cursor < be && slotEnd > bs;
//     });
//     if (!overlaps && cursor > now) slots.push(cursor.toISO()!);
//     cursor = slotEnd;
//   }

//   console.log(`[Calendar] Generated ${slots.length} available slots for ${dateStr}`);
//   return slots;
// }

// // Don't forget to fix the duration typing in your mock function as well!
// function generateMockSlots(location: LocationSchedule, dateStr: string): string[] {
//   const timezone = location.timezone || 'America/New_York';
//   const open_time = location.open_time || '09:00';
//   const close_time = location.close_time || '17:00';

//   // FIX: Cast to number
//   const appointment_duration_min = Number(location.appointment_duration_min) || 30;

//   const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
//   const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });
//   const now = DateTime.now();
//   const slots: string[] = [];
//   let cursor = dayStart;

//   while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
//     if (cursor > now) slots.push(cursor.toISO()!);
//     cursor = cursor.plus({ minutes: appointment_duration_min });
//   }
//   return slots.filter((_, i) => i % 3 !== 1).slice(0, 6);
// }


// export async function createCalendarEvent(
//   location: LocationSchedule,
//   params: { summary: string; description: string; startISO: string },
// ) {
//   const timezone = location.timezone || 'America/New_York';
//   const appointment_duration_min = location.appointment_duration_min || 30;
//   const calendar_id = location.calendar_id;

//   if (!calendar_id) {
//     const start = DateTime.fromISO(params.startISO, { zone: timezone });
//     return {
//       id: 'mock_' + Date.now(),
//       start: { dateTime: start.toISO() },
//       end: { dateTime: start.plus({ minutes: appointment_duration_min }).toISO() },
//       summary: params.summary,
//     };
//   }

//   const calendar = getCalendarClient();
//   const start = DateTime.fromISO(params.startISO, { zone: timezone });
//   const end = start.plus({ minutes: appointment_duration_min });

//   const event = await calendar.events.insert({
//     calendarId: calendar_id,
//     requestBody: {
//       summary: params.summary,
//       description: params.description,
//       start: { dateTime: start.toISO(), timeZone: timezone },
//       end: { dateTime: end.toISO(), timeZone: timezone },
//     },
//   });
//   return event.data;
// }

// export async function deleteCalendarEvent(
//   location: LocationSchedule,
//   calendarEventId: string | null,
// ): Promise<void> {
//   if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
//   if (!location.calendar_id) return;
//   const calendar = getCalendarClient();
//   await calendar.events
//     .delete({ calendarId: location.calendar_id, eventId: calendarEventId })
//     .catch(() => { });
// }

// export async function updateCalendarEventTime(
//   location: LocationSchedule,
//   calendarEventId: string,
//   startISO: string,
// ): Promise<void> {
//   if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
//   if (!location.calendar_id) return;

//   const timezone = location.timezone || 'America/New_York';
//   const appointment_duration_min = location.appointment_duration_min || 30;

//   const calendar = getCalendarClient();
//   const start = DateTime.fromISO(startISO, { zone: timezone });
//   const end = start.plus({ minutes: appointment_duration_min });

//   await calendar.events.patch({
//     calendarId: location.calendar_id,
//     eventId: calendarEventId,
//     requestBody: {
//       start: { dateTime: start.toISO(), timeZone: location.timezone },
//       end: { dateTime: end.toISO(), timeZone: location.timezone },
//     },
//   });
// }
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
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
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

function generateMockSlots(location: LocationSchedule, dateStr: string): string[] {
  const timezone = location.timezone || 'Asia/Kolkata';
  const open_time = location.open_time || '09:00';
  const close_time = location.close_time || '18:00';
  const appointment_duration_min = Number(location.appointment_duration_min) || 30;

  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });

  if (!dayStart.isValid) {
    console.error(`[Calendar] generateMockSlots: invalid date "${dateStr}"`);
    return [];
  }

  const now = DateTime.now().setZone(timezone);
  const slots: string[] = [];
  let cursor = dayStart;

  while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
    if (cursor > now) slots.push(cursor.toISO()!);
    cursor = cursor.plus({ minutes: appointment_duration_min });
  }

  // Simulate 2 taken slots so the demo feels realistic
  return slots.filter((_, i) => i % 3 !== 1).slice(0, 6);
}

export async function getAvailableSlots(location: LocationSchedule, dateStr: string): Promise<string[]> {
  const timezone = location.timezone || 'Asia/Kolkata';
  const open_time = location.open_time || '09:00';
  const close_time = location.close_time || '18:00';
  const appointment_duration_min = Number(location.appointment_duration_min) || 30;
  const calendar_id = location.calendar_id;

  // Normalise days_open
  let parsedDays = location.days_open as unknown;
  if (typeof parsedDays === 'string') {
    try { parsedDays = JSON.parse(parsedDays as string); } catch { parsedDays = [0, 1, 2, 3, 4, 5, 6]; }
  }
  const days_open = (Array.isArray(parsedDays) ? parsedDays : [0, 1, 2, 3, 4, 5, 6]).map(Number);

  // ── Build day boundaries IN the business timezone ───────────────────────────
  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });

  if (!dayStart.isValid || !dayEnd.isValid) {
    console.error(`[Calendar] Invalid date/time: dateStr="${dateStr}" open="${open_time}" tz="${timezone}"`);
    return [];
  }

  // Luxon weekday: Mon=1…Sun=7 → JS convention: Sun=0…Sat=6
  const jsWeekday = dayStart.weekday % 7;
  if (!days_open.includes(jsWeekday)) {
    console.log(`[Calendar] ${dateStr} (weekday ${jsWeekday}) not in days_open [${days_open}] — closed`);
    return [];
  }

  if (!calendar_id) {
    console.log(`[Calendar] No calendar_id for location — using mock slots`);
    return generateMockSlots(location, dateStr);
  }

  // ── Query Google Calendar freebusy ──────────────────────────────────────────
  try {
    const calendar = getCalendarClient();

    // IMPORTANT: always send UTC to the API but keep dayStart/dayEnd in local tz
    // for slot generation so we don't cross midnight on UTC offset boundaries
    const timeMin = dayStart.toUTC().toISO()!;
    const timeMax = dayEnd.toUTC().toISO()!;

    console.log(`[Calendar] freebusy query | calendarId=${calendar_id} | ${timeMin} → ${timeMax} (tz=${timezone})`);

    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'UTC',   // Google returns busy blocks in UTC — we compare in UTC below
        items: [{ id: calendar_id }],
      },
    });

    // Check for permission errors
    const calErrors = fb.data.calendars?.[calendar_id]?.errors;
    if (calErrors?.length) {
      console.error(`[Calendar] API permission error for ${calendar_id}:`, JSON.stringify(calErrors));
      console.warn(`[Calendar] Falling back to mock slots due to calendar API error`);
      return generateMockSlots(location, dateStr);
    }

    // busy blocks come back as UTC ISO strings
    const busy = fb.data.calendars?.[calendar_id]?.busy ?? [];
    console.log(`[Calendar] Busy blocks: ${busy.length} | slots window: ${dayStart.toFormat('HH:mm')}–${dayEnd.toFormat('HH:mm')} ${timezone}`);

    const now = DateTime.now().setZone(timezone);
    const slots: string[] = [];
    let cursor = dayStart;  // keep cursor in LOCAL timezone throughout

    while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
      const slotEnd = cursor.plus({ minutes: appointment_duration_min });

      // Compare against busy blocks — convert cursor to UTC for comparison
      const overlaps = busy.some((b) => {
        const busyStart = DateTime.fromISO(b.start!, { zone: 'UTC' });
        const busyEnd = DateTime.fromISO(b.end!, { zone: 'UTC' });
        const cStart = cursor.toUTC();
        const cEnd = slotEnd.toUTC();
        return cStart < busyEnd && cEnd > busyStart;
      });

      if (!overlaps && cursor > now) {
        slots.push(cursor.toISO()!);
      }
      cursor = slotEnd;
    }

    console.log(`[Calendar] ${slots.length} available slots for ${dateStr}`);
    return slots;

  } catch (err: any) {
    console.error(`[Calendar] freebusy call failed: ${err?.message}`);
    console.warn(`[Calendar] Falling back to mock slots`);
    return generateMockSlots(location, dateStr);
  }
}

export async function createCalendarEvent(
  location: LocationSchedule,
  params: { summary: string; description: string; startISO: string },
): Promise<{ id: string; start: any; end: any; summary: string }> {
  const timezone = location.timezone || 'Asia/Kolkata';
  const appointment_duration_min = Number(location.appointment_duration_min) || 30;
  const calendar_id = location.calendar_id;

  const start = DateTime.fromISO(params.startISO, { zone: timezone });
  if (!start.isValid) throw new Error(`Invalid startISO: "${params.startISO}"`);
  const end = start.plus({ minutes: appointment_duration_min });

  if (!calendar_id) {
    console.log(`[Calendar] No calendar_id — creating mock event`);
    return {
      id: `mock_${Date.now()}`,
      start: { dateTime: start.toISO() },
      end: { dateTime: end.toISO() },
      summary: params.summary,
    };
  }

  try {
    const calendar = getCalendarClient();
    const event = await calendar.events.insert({
      calendarId: calendar_id,
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: start.toISO()!, timeZone: timezone },
        end: { dateTime: end.toISO()!, timeZone: timezone },
      },
    });
    console.log(`[Calendar] Event created: ${event.data.id} — "${params.summary}"`);
    return event.data as any;
  } catch (err: any) {
    console.error(`[Calendar] Event insert failed: ${err?.message}`);
    // Save the appointment in DB even if calendar fails
    return {
      id: `mock_${Date.now()}`,
      start: { dateTime: start.toISO() },
      end: { dateTime: end.toISO() },
      summary: params.summary,
    };
  }
}

export async function deleteCalendarEvent(
  location: LocationSchedule,
  calendarEventId: string | null,
): Promise<void> {
  if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
  if (!location.calendar_id) return;
  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({ calendarId: location.calendar_id, eventId: calendarEventId });
    console.log(`[Calendar] Event deleted: ${calendarEventId}`);
  } catch (err: any) {
    console.warn(`[Calendar] Event delete failed (may already be gone): ${err?.message}`);
  }
}

export async function updateCalendarEventTime(
  location: LocationSchedule,
  calendarEventId: string,
  startISO: string,
): Promise<void> {
  if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
  if (!location.calendar_id) return;

  const timezone = location.timezone || 'Asia/Kolkata';
  const appointment_duration_min = Number(location.appointment_duration_min) || 30;
  const start = DateTime.fromISO(startISO, { zone: timezone });
  const end = start.plus({ minutes: appointment_duration_min });

  try {
    const calendar = getCalendarClient();
    await calendar.events.patch({
      calendarId: location.calendar_id,
      eventId: calendarEventId,
      requestBody: {
        start: { dateTime: start.toISO()!, timeZone: timezone },
        end: { dateTime: end.toISO()!, timeZone: timezone },
      },
    });
    console.log(`[Calendar] Event rescheduled: ${calendarEventId} → ${startISO}`);
  } catch (err: any) {
    console.error(`[Calendar] Event reschedule failed: ${err?.message}`);
  }
}