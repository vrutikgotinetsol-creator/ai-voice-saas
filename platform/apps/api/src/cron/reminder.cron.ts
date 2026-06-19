import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabase';
import { sendSms } from '../lib/sms';
import type { Business, LocationWithSecrets } from '@platform/shared-types';

/**
 * Hourly cron: sends 24h and 2h appointment reminders via each location's Twilio credentials.
 */
export function startReminderCron(): void {
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking for appointment reminders...');
    await processReminders('24h');
    await processReminders('2h');
  });

  console.log('[Cron] Reminder jobs scheduled (hourly)');
}

async function processReminders(type: '24h' | '2h'): Promise<void> {
  const now = new Date();
  const flagField = type === '24h' ? 'reminder_24h_sent' : 'reminder_2h_sent';
  const smsType = type === '24h' ? 'reminder_24h' : 'reminder_2h';

  const windowStart = new Date(now.getTime() + (type === '24h' ? 23 : 1.5) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (type === '24h' ? 25 : 2.5) * 60 * 60 * 1000);

  const { data: appointments, error } = await supabaseAdmin
    .from('appointments')
    .select('*, businesses(name), locations(*)')
    .eq('status', 'confirmed')
    .eq(flagField, false)
    .gte('start_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString());

  if (error) {
    console.error(`[Cron] Failed to fetch ${type} reminders:`, error.message);
    return;
  }

  let sentCount = 0;
  for (const appt of appointments || []) {
    const location = appt.locations as LocationWithSecrets | null;
    const business = appt.businesses as Business | null;
    if (!location || !business) continue;

    try {
      await sendSms({ ...location, name: business.name }, appt, smsType);
      await supabaseAdmin.from('appointments').update({ [flagField]: true }).eq('id', appt.id);
      sentCount++;
    } catch (err) {
      console.error(`[Cron] Failed ${type} reminder for appt ${appt.id}:`, err);
    }
  }

  if (sentCount) console.log(`[Cron] Sent ${sentCount} ${type} reminders`);
}
