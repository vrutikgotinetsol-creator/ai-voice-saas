-- ═══════════════════════════════════════════════════════════════════════
-- AI Receptionist SaaS — Core Tables
-- Migration 0002
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- platform_admins: platform owner / staff (NOT business tenants)
-- ───────────────────────────────────────────────────────────────────────
create table platform_admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────
-- plans: subscription tiers (Starter, Professional, Enterprise)
-- ───────────────────────────────────────────────────────────────────────
create table plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  stripe_price_id   text,
  amount_cents      int not null default 0,
  trial_days        int not null default 14,
  max_locations     int not null default 1,
  features          jsonb not null default '{}',
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

insert into plans (name, slug, amount_cents, trial_days, max_locations, features, sort_order) values
  ('Starter',      'starter',      9900,  14, 1,  '{"calls_per_month": 500,  "sms_reminders": true}',  1),
  ('Professional', 'professional', 19900, 14, 3,  '{"calls_per_month": 2000, "sms_reminders": true, "analytics": true}', 2),
  ('Enterprise',   'enterprise',   49900, 14, 10, '{"calls_per_month": -1,   "sms_reminders": true, "analytics": true, "priority_support": true}', 3);

-- ───────────────────────────────────────────────────────────────────────
-- businesses: tenant root (org-level settings)
-- ───────────────────────────────────────────────────────────────────────
create table businesses (
  id                          uuid primary key default gen_random_uuid(),
  owner_user_id               uuid references auth.users(id) on delete set null,
  name                        text not null,
  business_type               text,
  owner_name                  text,
  owner_email                 text,
  owner_phone                 text,
  address                     text,
  timezone                    text not null default 'America/New_York',
  agent_name                  text not null default 'Riya',
  voice_id                    text default 'Elliot',
  extra_info                  text,
  status                      business_status not null default 'pending',
  trial_started_at            timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_businesses_owner on businesses(owner_user_id);
create index idx_businesses_status on businesses(status);

-- ───────────────────────────────────────────────────────────────────────
-- locations: multi-location support (phone, calendar, hours per location)
-- ───────────────────────────────────────────────────────────────────────
create table locations (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references businesses(id) on delete cascade,
  name                        text not null,
  address                     text,
  timezone                    text not null default 'America/New_York',
  hours_text                  text,
  open_time                   text not null default '09:00',
  close_time                  text not null default '18:00',
  days_open                   int[] not null default '{1,2,3,4,5}',
  appointment_duration_min    int not null default 30,
  vapi_phone_number_id        text,
  vapi_phone_number_display   text,
  twilio_account_sid_enc      text,
  twilio_auth_token_enc       text,
  twilio_sms_from             text,
  calendar_id                 text,
  is_primary                  boolean not null default false,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_locations_business on locations(business_id);
create unique index idx_locations_vapi_number on locations(vapi_phone_number_id)
  where vapi_phone_number_id is not null;

-- ───────────────────────────────────────────────────────────────────────
-- services: pricing menu per business (optionally per location)
-- ───────────────────────────────────────────────────────────────────────
create table services (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  location_id     uuid references locations(id) on delete set null,
  name            text not null,
  price_label     text not null default '',
  duration_min    int,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index idx_services_business on services(business_id);
create index idx_services_location on services(location_id);

-- ───────────────────────────────────────────────────────────────────────
-- faqs: common questions per business
-- ───────────────────────────────────────────────────────────────────────
create table faqs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  question      text not null,
  answer        text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_faqs_business on faqs(business_id);

-- ───────────────────────────────────────────────────────────────────────
-- customers: CRM per business
-- ───────────────────────────────────────────────────────────────────────
create table customers (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete cascade,
  name                  text not null,
  phone                 text not null,
  email                 text,
  notes                 text,
  total_appointments    int not null default 0,
  lifetime_value_cents  int not null default 0,
  last_visit_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (business_id, phone)
);

create index idx_customers_business on customers(business_id);
create index idx_customers_phone on customers(business_id, phone);
create index idx_customers_name on customers(business_id, name);

-- ───────────────────────────────────────────────────────────────────────
-- appointments: bookings (AI or manual)
-- ───────────────────────────────────────────────────────────────────────
create table appointments (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete cascade,
  location_id           uuid references locations(id) on delete set null,
  customer_id           uuid references customers(id) on delete set null,
  customer_name         text not null,
  customer_phone        text not null,
  service_name          text,
  price_label           text,
  start_time            timestamptz not null,
  duration_minutes      int not null default 30,
  status                appointment_status not null default 'confirmed',
  calendar_event_id     text,
  confirmation_sms_sent boolean not null default false,
  reminder_24h_sent     boolean not null default false,
  reminder_2h_sent      boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_appointments_business on appointments(business_id);
create index idx_appointments_location on appointments(location_id);
create index idx_appointments_customer on appointments(customer_id);
create index idx_appointments_start_time on appointments(start_time);
create index idx_appointments_status on appointments(status);

-- ───────────────────────────────────────────────────────────────────────
-- subscriptions: Stripe billing per business
-- ───────────────────────────────────────────────────────────────────────
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null unique references businesses(id) on delete cascade,
  plan_id                  uuid references plans(id) on delete set null,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  status                   subscription_status not null default 'trialing',
  amount_cents             int not null default 19900,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_subscriptions_business on subscriptions(business_id);
create index idx_subscriptions_stripe_customer on subscriptions(stripe_customer_id);
create index idx_subscriptions_plan on subscriptions(plan_id);

-- ───────────────────────────────────────────────────────────────────────
-- call_logs: Vapi call metadata
-- ───────────────────────────────────────────────────────────────────────
create table call_logs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  location_id     uuid references locations(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  vapi_call_id    text unique,
  customer_phone  text,
  duration_sec    int,
  cost_usd        numeric(10,4),
  ended_reason    text,
  outcome         call_outcome,
  summary         text,
  sentiment       text,
  created_at      timestamptz not null default now()
);

create index idx_call_logs_business on call_logs(business_id);
create index idx_call_logs_location on call_logs(location_id);
create index idx_call_logs_created on call_logs(created_at);

-- ───────────────────────────────────────────────────────────────────────
-- call_transcripts: full call transcripts (separate for size/perf)
-- ───────────────────────────────────────────────────────────────────────
create table call_transcripts (
  id            uuid primary key default gen_random_uuid(),
  call_log_id   uuid not null unique references call_logs(id) on delete cascade,
  transcript    text not null default '',
  created_at    timestamptz not null default now()
);

create index idx_call_transcripts_call on call_transcripts(call_log_id);

-- ───────────────────────────────────────────────────────────────────────
-- leads: non-booking call captures
-- ───────────────────────────────────────────────────────────────────────
create table leads (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  location_id         uuid references locations(id) on delete set null,
  call_log_id         uuid references call_logs(id) on delete set null,
  name                text,
  phone               text not null,
  call_reason         text,
  follow_up_required  boolean not null default true,
  status              lead_status not null default 'new',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_leads_business on leads(business_id);
create index idx_leads_status on leads(business_id, status);

-- ───────────────────────────────────────────────────────────────────────
-- daily_stats: pre-aggregated analytics per business per day
-- ───────────────────────────────────────────────────────────────────────
create table daily_stats (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete cascade,
  stat_date             date not null,
  appointments_count    int not null default 0,
  calls_count           int not null default 0,
  calls_answered        int not null default 0,
  calls_missed          int not null default 0,
  bookings_count        int not null default 0,
  cancellations_count   int not null default 0,
  leads_captured        int not null default 0,
  revenue_cents         int not null default 0,
  avg_call_duration_sec int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (business_id, stat_date)
);

create index idx_daily_stats_business_date on daily_stats(business_id, stat_date);

-- ───────────────────────────────────────────────────────────────────────
-- audit_logs: security & compliance trail
-- ───────────────────────────────────────────────────────────────────────
create table audit_logs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references businesses(id) on delete set null,
  actor_user_id   uuid references auth.users(id) on delete set null,
  actor_type      audit_actor_type not null default 'system',
  action          text not null,
  resource_type   text not null,
  resource_id     text,
  metadata        jsonb not null default '{}',
  ip_address      inet,
  created_at      timestamptz not null default now()
);

create index idx_audit_logs_business on audit_logs(business_id);
create index idx_audit_logs_actor on audit_logs(actor_user_id);
create index idx_audit_logs_created on audit_logs(created_at);
