const cron = require('node-cron');
const { supabaseAdmin } = require('../lib/supabase');
const { sendSmsReminder } = require('../lib/sms');

/**
 * Runs every hour. Finds appointments starting in the next 24h that
 * haven't had a reminder sent yet, and sends one using THAT BUSINESS's
 * own Twilio credentials.
 */
function startReminderCron() {
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking for appointment reminders...');

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('*, businesses(*)')
      .eq('status', 'confirmed')
      .eq('reminder_sent', false)
      .gte('start_time', now.toISOString())
      .lte('start_time', in24h.toISOString());

    if (error) {
      console.error('[Cron] Failed to fetch appointments:', error.message);
      return;
    }

    let sentCount = 0;
    for (const appt of appointments || []) {
      if (!appt.businesses) continue;
      try {
        await sendSmsReminder(appt.businesses, appt);
        await supabaseAdmin.from('appointments').update({ reminder_sent: true }).eq('id', appt.id);
        sentCount++;
      } catch (err) {
        console.error(`[Cron] Failed to send reminder for appt ${appt.id}:`, err.message);
      }
    }

    if (sentCount) console.log(`[Cron] Sent ${sentCount} reminders`);
  });

  console.log('[Cron] Reminder job scheduled (hourly)');
}

module.exports = { startReminderCron };
