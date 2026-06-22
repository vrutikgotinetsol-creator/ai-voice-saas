# AI Voice Receptionist SaaS — Full Architecture Plan

## 1. The two-sided system

```
                          ┌─────────────────────────────┐
                          │   YOUR PLATFORM ADMIN APP    │
                          │   (you, the founder/dev)     │
                          │                               │
                          │  - See ALL clients            │
                          │  - Appointments per client     │
                          │  - Subscription/payment status │
                          │  - Activate/suspend clients     │
                          │  - Create client logins         │
                          │  - Platform-wide revenue stats   │
                          └──────────────┬────────────────┘
                                         │
                                         │ Supabase (shared Postgres DB)
                                         │ service_role key = sees everything
                                         │
                          ┌──────────────┴────────────────┐
                          │                                 │
              ┌───────────▼──────────┐         ┌───────────▼──────────┐
              │  CLIENT DASHBOARD A   │         │  CLIENT DASHBOARD B   │
              │  (Glow Salon owner)   │         │  (Bright Dental owner)│
              │                        │         │                        │
              │  - Their appointments  │         │  - Their appointments  │
              │  - Their business setup│         │  - Their business setup│
              │  - Their subscription  │         │  - Their subscription  │
              │  (RLS: only own data)  │         │  (RLS: only own data)  │
              └────────────────────────┘         └────────────────────────┘
                          │                                 │
                          └──────────────┬──────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   NODE.JS BACKEND     │
                              │   (Express API)        │
                              │                          │
                              │  - Vapi webhooks          │
                              │  - Stripe webhooks         │
                              │  - Auth-gated REST API      │
                              │  - Cron jobs (SMS reminders) │
                              └──────────┬──────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
              ┌─────▼─────┐      ┌───────▼──────┐      ┌──────▼──────┐
              │   Vapi     │      │    Stripe      │      │   Twilio     │
              │ (voice AI) │      │  (subscriptions)│      │ (SMS + calls)│
              └────────────┘      └────────────────┘      └──────────────┘
```

## 2. Why this stack

- **Supabase** gives us Postgres + Auth + Row Level Security out of the box.
  RLS means the database itself enforces "shop owner A can never see shop
  owner B's data" — even if there's a bug in our app code, the database
  blocks the leak. This is the standard pattern for multi-tenant SaaS.
- **Two separate frontends, one backend.** The platform-admin app and the
  client app are different React builds (different login flows, different
  views) but they both talk to the same Node/Express API and the same
  Supabase database. We are NOT duplicating business logic.
- **Service role vs anon key.** Your Node backend uses Supabase's
  `service_role` key for admin operations (it bypasses RLS entirely — only
  ever used server-side, never shipped to a browser). Client dashboards
  authenticate normally through Supabase Auth and are bound by RLS.

## 3. Database schema (Supabase / Postgres)

### `platform_admins`
You (and any future staff). Not a shop owner.
```sql
id              uuid primary key references auth.users(id)
email           text
full_name       text
created_at      timestamptz default now()
```

### `businesses` (shop owner accounts — the tenants)
```sql
id                          uuid primary key default gen_random_uuid()
owner_user_id               uuid references auth.users(id)   -- the shop owner's login
name                        text not null
business_type               text
address                     text
timezone                    text default 'America/New_York'
hours_text                  text
agent_name                  text default 'Riya'
open_time                   text          -- '10:00'
close_time                  text          -- '19:00'
days_open                   int[]         -- [0,1,2,3,4,5,6]
appointment_duration_min    int default 30
vapi_phone_number_id        text          -- which Vapi number routes here
vapi_phone_number_display   text          -- e.g. '+1 424 699 3691' (for display)
twilio_account_sid          text          -- per-client Twilio credentials (encrypted)
twilio_auth_token            text          -- per-client Twilio credentials (encrypted)
twilio_sms_from              text
calendar_id                  text          -- Google Calendar ID
extra_info                   text
status                       text default 'pending'  -- pending | trial | active | suspended | cancelled
trial_started_at             timestamptz
created_at                   timestamptz default now()
updated_at                   timestamptz default now()
```

### `services` (per business)
```sql
id            uuid primary key default gen_random_uuid()
business_id   uuid references businesses(id) on delete cascade
name          text not null
price_label   text     -- '$40' or '₹400' (display string, not parsed for billing)
sort_order    int default 0
```

### `faqs` (per business)
```sql
id            uuid primary key default gen_random_uuid()
business_id   uuid references businesses(id) on delete cascade
question      text not null
answer        text not null
sort_order    int default 0
```

### `appointments`
```sql
id                  uuid primary key default gen_random_uuid()
business_id         uuid references businesses(id) on delete cascade
customer_name       text not null
customer_phone      text not null
service_name        text
price_label          text          -- snapshot of price at booking time
start_time           timestamptz not null
duration_minutes     int
status                text default 'confirmed'  -- confirmed | cancelled | completed | no_show
calendar_event_id    text
reminder_sent         boolean default false
notes                 text
created_at             timestamptz default now()
```

### `subscriptions` (Stripe-linked billing per business)
```sql
id                      uuid primary key default gen_random_uuid()
business_id             uuid references businesses(id) on delete cascade unique
stripe_customer_id      text
stripe_subscription_id  text
plan                    text default 'standard'   -- room to add tiers later
status                  text default 'trialing'    -- trialing | active | past_due | canceled
amount_cents            int default 19900            -- $199.00
current_period_end      timestamptz
created_at              timestamptz default now()
updated_at              timestamptz default now()
```

### `call_logs` (optional but valuable — ties Vapi call data to appointments)
```sql
id              uuid primary key default gen_random_uuid()
business_id     uuid references businesses(id) on delete cascade
vapi_call_id    text
duration_sec    int
cost_usd        numeric(10,4)
ended_reason    text
created_at      timestamptz default now()
```

## 4. Row Level Security policies

```sql
-- Enable RLS everywhere
alter table businesses enable row level security;
alter table services enable row level security;
alter table faqs enable row level security;
alter table appointments enable row level security;
alter table subscriptions enable row level security;
alter table call_logs enable row level security;

-- Shop owners see only their own business row
create policy "owner_select_own_business" on businesses
  for select using (owner_user_id = auth.uid());
create policy "owner_update_own_business" on businesses
  for update using (owner_user_id = auth.uid());

-- Shop owners see only their own services/faqs/appointments
-- (via join through businesses.owner_user_id)
create policy "owner_select_own_services" on services
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );
create policy "owner_write_own_services" on services
  for all using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );
-- (same pattern repeated for faqs, appointments — read-only for appointments
--  since only the AI/backend should create them, not the shop owner directly)
create policy "owner_select_own_appointments" on appointments
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- Platform admins bypass via service_role key in the backend — no RLS
-- policy needed for them; the Node backend uses service_role for ALL
-- platform-admin-dashboard queries.
```

This is the standard "tenant isolation via join to a parent ownership table"
pattern, which is the documented approach for Supabase multi-tenant apps.

## 5. Two frontends, what each shows

### A. Platform Admin Dashboard (you)
- **Clients list** — every business, with status (trial/active/suspended),
  days left in trial, MRR contribution
- **Client detail view** — drill into one business: their appointment volume
  (chart), call volume, last 30 days activity, raw Vapi call logs
- **Billing/subscriptions** — Stripe subscription status per client, manually
  trigger suspend/reactivate, view payment history
- **Create client** — the onboarding flow: enter business name + owner email
  → creates their Supabase Auth user + business row + sends them their
  login credential
- **Platform-wide stats** — total MRR, total appointments booked across all
  clients this month, churn

### B. Client Dashboard (shop owner)
- **Appointments list** — date, time, customer name, phone, service, price,
  status — exactly what you described, filterable by date/status
- **Business Setup** — services, pricing, hours, FAQs (the part they manage
  themselves so the AI stays accurate)
- **Subscription** — their trial countdown / active plan / "Manage billing"
  button (opens Stripe customer portal)
- **No AI prompt visibility, no other clients' data, no backend internals**
  — explicitly hidden per your requirement

## 6. Auth flow (manual onboarding, as you chose)

1. You create the business in your Platform Admin dashboard (name, owner
   email, Vapi number, Twilio creds for that client)
2. Backend calls `supabase.auth.admin.createUser()` with a temporary password
   and the owner's email, and creates the linked `businesses` row with
   `owner_user_id` set
3. You manually share the email + temp password with the shop owner (or the
   backend can email it via Resend/SendGrid later)
4. Shop owner logs into the Client Dashboard, is forced to set a new password
   on first login (Supabase Auth supports this natively)

## 7. Repo structure

```
/platform
  /apps
    /admin-web          → React (Vite) — your platform admin dashboard
    /client-web         → React (Vite) — shop owner dashboard
    /api                → Node + Express — shared backend for both + Vapi/Stripe webhooks
  /packages
    /shared-types        → TypeScript types shared between admin-web, client-web, api
  /supabase
    /migrations          → SQL migration files (schema above)
  docker-compose.yml (optional, for local dev)
```

## 8. Deployment plan

- **Supabase**: hosted project (free tier works for MVP, upgrade as you scale)
- **api**: deploy to Render (as you already have) — one Node service
- **admin-web**: deploy to Vercel or Render Static Site — password-gated via Supabase Auth, restricted to platform_admins table
- **client-web**: deploy to Vercel or Render Static Site — separate URL/subdomain, e.g. `app.yourdomain.com` vs `admin.yourdomain.com`
- **Stripe**: webhook endpoint on the same Node API (`/webhook/stripe`)
- **Vapi**: webhook endpoint on the same Node API (`/webhook/vapi`) — unchanged from current architecture

## 9. Build order (what I'll build next, in sequence)

1. Supabase schema + RLS policies (SQL migration file)
2. Node/Express API: auth middleware (admin vs client), all CRUD routes,
   Vapi webhook (dynamic prompt from DB), Stripe webhook + checkout
3. Client dashboard (React): login, appointments view, business setup,
   subscription/billing view
4. Platform admin dashboard (React): login, clients list, client detail,
   create-client flow, billing overview
5. Deployment instructions for all 3 (api, admin-web, client-web) + Supabase
   migration steps

This is a large build. I'll build it in stages across the following
messages so each piece can be tested before the next is layered on, rather
than dumping everything at once with no way to verify correctness.
