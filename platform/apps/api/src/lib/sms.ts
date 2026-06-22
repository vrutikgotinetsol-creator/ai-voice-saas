import { DateTime } from 'luxon';
import twilio from 'twilio';
import { decryptOptional } from './encryption';
import type { Appointment, Business, LocationWithSecrets } from '@platform/shared-types';

type SmsContext = Pick<Business, 'name'> &
  Pick<LocationWithSecrets, 'timezone' | 'twilio_account_sid_enc' | 'twilio_auth_token_enc' | 'twilio_sms_from'>;

export type SmsType = 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'cancellation';

function buildMessage(
  type: SmsType,
  businessName: string,
  appointment: Pick<Appointment, 'customer_name' | 'service_name' | 'start_time'>,
  timeFormatted: string,
): string {
  switch (type) {
    case 'confirmation':
      return (
        `Hi ${appointment.customer_name}, your ${appointment.service_name} appointment at ${businessName} ` +
        `is confirmed for ${timeFormatted}. Reply or call us if you need to reschedule.`
      );
    case 'reminder_24h':
      return (
        `Hi ${appointment.customer_name}, reminder from ${businessName}: your ${appointment.service_name} ` +
        `appointment is tomorrow at ${timeFormatted}. Reply or call to reschedule.`
      );
    case 'reminder_2h':
      return (
        `Hi ${appointment.customer_name}, your ${appointment.service_name} at ${businessName} ` +
        `starts in 2 hours (${timeFormatted}). See you soon!`
      );
    case 'cancellation':
      return (
        `Hi ${appointment.customer_name}, your ${appointment.service_name} appointment at ${businessName} ` +
        `on ${timeFormatted} has been cancelled. Call us to rebook.`
      );
  }
}

export async function sendSms(
  location: SmsContext,
  appointment: Pick<Appointment, 'customer_name' | 'customer_phone' | 'service_name' | 'start_time'>,
  type: SmsType,
): Promise<{ mock?: boolean; sid?: string }> {
  const timeFormatted = DateTime.fromISO(appointment.start_time, { zone: location.timezone }).toLocaleString(
    DateTime.DATETIME_MED,
  );
  const message = buildMessage(type, location.name, appointment, timeFormatted);

  const accountSid = decryptOptional(location.twilio_account_sid_enc);
  const authToken = decryptOptional(location.twilio_auth_token_enc);
  const from = location.twilio_sms_from;

  if (!accountSid || !authToken || !from) {
    console.log(`[SMS MOCK — ${location.name}] To: ${appointment.customer_phone}\n${message}`);
    return { mock: true };
  }

  const client = twilio(accountSid, authToken);
  const result = await client.messages.create({
    from,
    to: appointment.customer_phone,
    body: message,
  });

  console.log(`[SMS — ${location.name}] ${type} sent to ${appointment.customer_phone}, SID: ${result.sid}`);
  return { sid: result.sid };
}

/** @deprecated Use sendSms with type 'reminder_24h' */
export async function sendSmsReminder(
  location: SmsContext,
  appointment: Pick<Appointment, 'customer_name' | 'customer_phone' | 'service_name' | 'start_time'>,
) {
  return sendSms(location, appointment, 'reminder_24h');
}
