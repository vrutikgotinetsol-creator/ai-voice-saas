import { supabaseAdmin } from '../lib/supabase';
import { updateCalendarEventTime } from '../lib/calendar';

export async function rescheduleAppointment(
  businessId: string,
  appointmentId: string,
  startTime: string,
): Promise<{ error?: string }> {
  const { data: appt, error } = await supabaseAdmin
    .from('appointments')
    .select('*, locations(*)')
    .eq('id', appointmentId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error || !appt) return { error: 'Appointment not found' };

  if (appt.calendar_event_id && appt.locations) {
    await updateCalendarEventTime(appt.locations, appt.calendar_event_id, startTime).catch(console.error);
  }

  const { error: updateError } = await supabaseAdmin
    .from('appointments')
    .update({ start_time: startTime })
    .eq('id', appointmentId)
    .eq('business_id', businessId);

  if (updateError) return { error: updateError.message };
  return {};
}
