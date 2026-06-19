-- ═══════════════════════════════════════════════════════════════════════
-- AI Voice Receptionist SaaS — Initial Schema
-- Run this in Supabase SQL Editor (or via `supabase db push`)
-- ═══════════════════════════════════════════════════════════════════════

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────────────────
-- platform_admins: you (and any future staff) — NOT shop owners
-- ───────────────────────────────────────────────────────────────────────
create table platform_admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────
-- businesses: one row per client (shop owner / tenant)
-- ───────────────────────────────────────────────────────────────────────
create table businesses (
  id                          uuid primary key default gen_random_uuid(),
  owner_user_id               uuid references auth.users(id) on delete set null,
  name                        text not null,
  business_type               text,
  address                     text,
  timezone                    text not null default 'America/New_York',
  hours_text                  text,
  agent_name                  text not null default 'Riya',
  open_time                   text not null default '09:00',
  close_time                  text not null default '18:00',
  days_open                   int[] not null default '{0,1,2,3,4,5,6}',
  appointment_duration_min    int not null default 30,
  vapi_phone_number_id        text,
  vapi_phone_number_display   text,
  twilio_account_sid          text,
  twilio_auth_token           text,
  twilio_sms_from             text,
  calendar_id                 text,
  extra_info                  text,
  status                      text not null default 'pending'
                                check (status in ('pending','trial','active','suspended','cancelled')),
  trial_started_at            timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_businesses_owner on businesses(owner_user_id);
create index idx_businesses_vapi_number on businesses(vapi_phone_number_id);
create index idx_businesses_status on businesses(status);

-- ───────────────────────────────────────────────────────────────────────
-- services: pricing menu per business
-- ───────────────────────────────────────────────────────────────────────
create table services (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  name          text not null,
  price_label   text not null default '',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_services_business on services(business_id);

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
-- appointments: bookings made by the AI (or manually by the shop owner)
-- ───────────────────────────────────────────────────────────────────────
create table appointments (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  customer_name       text not null,
  customer_phone      text not null,
  service_name        text,
  price_label         text,
  start_time          timestamptz not null,
  duration_minutes    int not null default 30,
  status              text not null default 'confirmed'
                        check (status in ('confirmed','cancelled','completed','no_show')),
  calendar_event_id   text,
  reminder_sent       boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now()
);

create index idx_appointments_business on appointments(business_id);
create index idx_appointments_start_time on appointments(start_time);
create index idx_appointments_status on appointments(status);

-- ───────────────────────────────────────────────────────────────────────
-- subscriptions: Stripe billing state per business
-- ───────────────────────────────────────────────────────────────────────
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null unique references businesses(id) on delete cascade,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  plan                     text not null default 'standard',
  status                   text not null default 'trialing'
                             check (status in ('trialing','active','past_due','canceled','incomplete')),
  amount_cents             int not null default 19900,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_subscriptions_business on subscriptions(business_id);
create index idx_subscriptions_stripe_customer on subscriptions(stripe_customer_id);

-- ───────────────────────────────────────────────────────────────────────
-- call_logs: raw Vapi call metadata, for platform-admin analytics
-- ───────────────────────────────────────────────────────────────────────
create table call_logs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  vapi_call_id    text,
  duration_sec    int,
  cost_usd        numeric(10,4),
  ended_reason    text,
  outcome         text, -- 'booked' | 'faq_only' | 'cancelled_appt' | 'no_action' | 'silence'
  created_at      timestamptz not null default now()
);

create index idx_call_logs_business on call_logs(business_id);

-- ═══════════════════════════════════════════════════════════════════════
-- updated_at auto-touch trigger (businesses + subscriptions)
-- ═══════════════════════════════════════════════════════════════════════
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════

alter table businesses enable row level security;
alter table services enable row level security;
alter table faqs enable row level security;
alter table appointments enable row level security;
alter table subscriptions enable row level security;
alter table call_logs enable row level security;
alter table platform_admins enable row level security;

-- platform_admins: an admin can read their own row (used to check role
-- client-side); writes are service_role only (no policy = blocked for
-- normal users, since service_role bypasses RLS entirely).
create policy "admin_select_self" on platform_admins
  for select using (id = auth.uid());

-- businesses: owner can select/update their own row only.
-- (Insert/delete of businesses is platform-admin-only, done via service_role
-- from the Node backend — no policy needed since service_role bypasses RLS.)
create policy "owner_select_own_business" on businesses
  for select using (owner_user_id = auth.uid());

create policy "owner_update_own_business" on businesses
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- services: owner can fully manage services for their own business
create policy "owner_select_own_services" on services
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_write_own_services" on services
  for insert with check (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_update_own_services" on services
  for update using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_delete_own_services" on services
  for delete using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- faqs: same pattern as services
create policy "owner_select_own_faqs" on faqs
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_write_own_faqs" on faqs
  for insert with check (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_update_own_faqs" on faqs
  for update using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_delete_own_faqs" on faqs
  for delete using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- appointments: shop owner can READ ONLY (the AI/backend creates these via
-- service_role, not the owner directly). Owners CAN update status (e.g.
-- mark as completed / cancel manually from their dashboard).
create policy "owner_select_own_appointments" on appointments
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

create policy "owner_update_own_appointments" on appointments
  for update using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- subscriptions: read-only for the owner (Stripe webhook + admin manage writes)
create policy "owner_select_own_subscription" on subscriptions
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- call_logs: read-only for the owner, for transparency (optional but nice)
create policy "owner_select_own_call_logs" on call_logs
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Notes:
-- - The Node API's platform-admin routes use the Supabase service_role
--   key, which bypasses ALL of the above RLS policies. That key must
--   NEVER be sent to any browser — server-side only.
-- - The client-web app uses the anon key + the logged-in user's JWT,
--   so every query is automatically scoped by these policies.
-- ═══════════════════════════════════════════════════════════════════════
