// ── Enums (mirror Postgres enums) ──────────────────────────────────────

export type BusinessStatus = 'pending' | 'trial' | 'active' | 'suspended' | 'cancelled';
export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export type LeadStatus = 'new' | 'contacted' | 'won' | 'lost';
export type CallOutcome =
  | 'appointment_booked'
  | 'faq_answered'
  | 'lead_captured'
  | 'appointment_cancelled'
  | 'no_action';
export type AuditActorType = 'platform_admin' | 'business_owner' | 'system' | 'webhook';

// ── Database row types ───────────────────────────────────────────────────

export interface PlatformAdmin {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  stripe_price_id: string | null;
  amount_cents: number;
  trial_days: number;
  max_locations: number;
  features: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_user_id: string | null;
  name: string;
  business_type: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  address: string | null;
  timezone: string;
  agent_name: string;
  voice_id: string | null;
  extra_info: string | null;
  status: BusinessStatus;
  trial_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  business_id: string;
  name: string;
  address: string | null;
  timezone: string;
  hours_text: string | null;
  open_time: string;
  close_time: string;
  days_open: number[];
  appointment_duration_min: number;
  vapi_phone_number_id: string | null;
  vapi_phone_number_display: string | null;
  twilio_sms_from: string | null;
  calendar_id: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Location with encrypted Twilio fields — server-side only */
export interface LocationWithSecrets extends Location {
  twilio_account_sid_enc: string | null;
  twilio_auth_token_enc: string | null;
}

export interface Service {
  id: string;
  business_id: string;
  location_id: string | null;
  name: string;
  price_label: string;
  duration_min: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Faq {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  total_appointments: number;
  lifetime_value_cents: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  location_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  service_name: string | null;
  price_label: string | null;
  start_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  calendar_event_id: string | null;
  confirmation_sms_sent: boolean;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  amount_cents: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  business_id: string;
  location_id: string | null;
  customer_id: string | null;
  vapi_call_id: string | null;
  customer_phone: string | null;
  duration_sec: number | null;
  cost_usd: number | null;
  ended_reason: string | null;
  outcome: CallOutcome | null;
  summary: string | null;
  sentiment: string | null;
  created_at: string;
}

export interface CallTranscript {
  id: string;
  call_log_id: string;
  transcript: string;
  created_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  location_id: string | null;
  call_log_id: string | null;
  name: string | null;
  phone: string;
  call_reason: string | null;
  follow_up_required: boolean;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyStat {
  id: string;
  business_id: string;
  stat_date: string;
  appointments_count: number;
  calls_count: number;
  calls_answered: number;
  calls_missed: number;
  bookings_count: number;
  cancellations_count: number;
  leads_captured: number;
  revenue_cents: number;
  avg_call_duration_sec: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string | null;
  actor_user_id: string | null;
  actor_type: AuditActorType;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// ── API DTOs ─────────────────────────────────────────────────────────────

export interface CreateClientRequest {
  ownerEmail: string;
  ownerPassword: string;
  ownerName?: string;
  name: string;
  business_type?: string;
  owner_phone?: string;
  planSlug?: string;
  location?: {
    name: string;
    address?: string;
    timezone?: string;
    vapi_phone_number_id?: string;
    vapi_phone_number_display?: string;
    twilio_account_sid?: string;
    twilio_auth_token?: string;
    twilio_sms_from?: string;
    calendar_id?: string;
  };
}

export interface PlatformStats {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  suspendedClients: number;
  mrr: number;
  totalCalls: number;
  totalAppointments: number;
  aiBookingRate: number;
}

export interface ClientBusinessResponse extends Business {
  services?: Service[];
  faqs?: Faq[];
  locations?: Location[];
  subscriptions?: Subscription | Subscription[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  code?: string;
}
