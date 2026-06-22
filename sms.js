const { DateTime } = require('luxon');
const twilio = require('twilio');

/**
 * Sends an SMS using THIS SPECIFIC BUSINESS's own Twilio credentials
 * (twilio_account_sid, twilio_auth_token, twilio_sms_from columns on the
 * businesses table). This is what makes the platform "BYO Twilio number"
 * per client, as opposed to one shared number for everyone.
 */
async function sendSmsReminder(business, appointment) {
  const { twilio_account_sid, twilio_auth_token, twilio_sms_from, timezone, name } = business;

  const time = DateTime.fromISO(appointment.start_time, { zone: timezone }).toLocaleString(
    DateTime.DATETIME_MED
  );

  const message =
    `Hi ${appointment.customer_name}, this is a reminder from ${name}. ` +
    `Your ${appointment.service_name} appointment is confirmed for ${time}. ` +
    `Reply or call us if you need to reschedule. Thank you!`;

  if (!twilio_account_sid || !twilio_auth_token || !twilio_sms_from) {
    console.log(`[SMS MOCK — ${name}] To: ${appointment.customer_phone}\n${message}`);
    return { mock: true };
  }

  const client = twilio(twilio_account_sid, twilio_auth_token);
  const result = await client.messages.create({
    from: twilio_sms_from,
    to: appointment.customer_phone,
    body: message,
  });

  console.log(`[SMS — ${name}] Sent to ${appointment.customer_phone}, SID: ${result.sid}`);
  return result;
}

module.exports = { sendSmsReminder };
