import { google } from 'googleapis';
import { DateTime } from 'luxon';

/**
 * Returns a Google Calendar API client using the service account
 * credentials from env vars.
 *
 * IMPORTANT: The service account must have the Google Calendar API
 * enabled in its Cloud project, AND the calendar must be shared with
 * the service account email (with "Make changes to events" permission).
 *
 * The Firebase Admin SDK service account (firebase-adminsdk-*) does NOT
 * have Calendar API access by default — see the setup guide below.
 */
function getCalendarClient() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? '')
    .replace(/\\n/g, '\n')
    .replace(/^"|"$/g, ''); // strip surrounding quotes if any

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:  privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

/**
 * Generates mock slots when no calendar_id is configured.
 * Useful for demos and testing before Google Calendar is connected.
 */
function generateMockSlots(location: any, dateStr: string): string[] {
  const { timezone, open_time, close_time, appointment_duration_min } = location;
  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd   = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });
  if (!dayStart.isValid) return [];

  const now   = DateTime.now();
  const slots: string[] = [];
  let cursor  = dayStart;

  while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
    if (cursor > now) slots.push(cursor.toISO()!);
    cursor = cursor.plus({ minutes: appointment_duration_min });
  }
  // Simulate ~2 taken slots so the demo feels real
  return slots.filter((_, i) => i % 3 !== 1).slice(0, 6);
}

/**
 * Returns available ISO start times for a given location + date.
 * Falls back to mock slots if calendar_id is not set.
 */
export async function getAvailableSlots(location: any, dateStr: string): Promise<string[]> {
  const {
    calendar_id,
    timezone,
    open_time,
    close_time,
    days_open,
    appointment_duration_min,
  } = location;

  if (!calendar_id) {
    console.log(`[Calendar] No calendar_id for location ${location.id} — using mock slots`);
    return generateMockSlots(location, dateStr);
  }

  const dayStart = DateTime.fromISO(`${dateStr}T${open_time}`, { zone: timezone });
  const dayEnd   = DateTime.fromISO(`${dateStr}T${close_time}`, { zone: timezone });

  if (!dayStart.isValid) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  // Luxon weekday: 1=Mon…7=Sun → JS weekday: 0=Sun…6=Sat
  const jsWeekday = dayStart.weekday % 7;
  if (!(days_open as number[]).includes(jsWeekday)) {
    console.log(`[Calendar] ${dateStr} is a closed day for location ${location.id}`);
    return [];
  }

  try {
    const calendar = getCalendarClient();
    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toUTC().toISO()!,
        timeMax: dayEnd.toUTC().toISO()!,
        timeZone: timezone,
        items: [{ id: calendar_id }],
      },
    });

    const busy = fb.data.calendars?.[calendar_id]?.busy ?? [];
    const now   = DateTime.now();
    const slots: string[] = [];
    let cursor  = dayStart;

    while (cursor.plus({ minutes: appointment_duration_min }) <= dayEnd) {
      const slotEnd = cursor.plus({ minutes: appointment_duration_min });
      const overlaps = busy.some((b) => {
        const bs = DateTime.fromISO(b.start!);
        const be = DateTime.fromISO(b.end!);
        return cursor < be && slotEnd > bs;
      });
      if (!overlaps && cursor > now) {
        slots.push(cursor.toISO()!);
      }
      cursor = slotEnd;
    }

    return slots;
  } catch (err: any) {
    console.error(`[Calendar] freebusy query failed:`, err?.message);
    // If calendar call fails, fall back to mock so the call doesn't drop
    console.warn(`[Calendar] Falling back to mock slots`);
    return generateMockSlots(location, dateStr);
  }
}

/**
 * Creates a Google Calendar event for a booked appointment.
 */
export async function createCalendarEvent(
  location: any,
  { summary, description, startISO }: { summary: string; description: string; startISO: string }
): Promise<{ id: string; start: any; end: any; summary: string }> {
  const { calendar_id, timezone, appointment_duration_min } = location;

  const start = DateTime.fromISO(startISO, { zone: timezone });
  if (!start.isValid) throw new Error(`Invalid startISO: ${startISO}`);
  const end = start.plus({ minutes: appointment_duration_min });

  if (!calendar_id) {
    // Mock event when no calendar configured
    return {
      id:      `mock_${Date.now()}`,
      start:   { dateTime: start.toISO() },
      end:     { dateTime: end.toISO() },
      summary,
    };
  }

  try {
    const calendar = getCalendarClient();
    const event = await calendar.events.insert({
      calendarId: calendar_id,
      requestBody: {
        summary,
        description,
        start: { dateTime: start.toISO()!, timeZone: timezone },
        end:   { dateTime: end.toISO()!,   timeZone: timezone },
      },
    });
    return event.data as any;
  } catch (err: any) {
    console.error(`[Calendar] Event insert failed:`, err?.message);
    // Return mock so appointment still saves in DB even if calendar fails
    return {
      id:      `mock_${Date.now()}`,
      start:   { dateTime: start.toISO() },
      end:     { dateTime: end.toISO() },
      summary,
    };
  }
}

/**
 * Deletes a Google Calendar event when an appointment is cancelled.
 */
export async function deleteCalendarEvent(location: any, calendarEventId: string | null): Promise<void> {
  if (!calendarEventId || calendarEventId.startsWith('mock_')) return;
  if (!location?.calendar_id) return;

  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({ calendarId: location.calendar_id, eventId: calendarEventId });
  } catch (err: any) {
    // Don't throw — a failed delete shouldn't break the cancellation flow
    console.warn(`[Calendar] Event delete failed (may already be gone):`, err?.message);
  }
}
