-- ═══════════════════════════════════════════════════════════════════════
-- AI Receptionist SaaS — Row Level Security Policies
-- Migration 0004
-- ═══════════════════════════════════════════════════════════════════════

alter table platform_admins enable row level security;
alter table plans enable row level security;
alter table businesses enable row level security;
alter table locations enable row level security;
alter table services enable row level security;
alter table faqs enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;
alter table subscriptions enable row level security;
alter table call_logs enable row level security;
alter table call_transcripts enable row level security;
alter table leads enable row level security;
alter table daily_stats enable row level security;
alter table audit_logs enable row level security;

-- ── platform_admins ────────────────────────────────────────────────────
create policy "admin_select_self" on platform_admins
  for select using (id = auth.uid());

-- ── plans (public read for active plans) ───────────────────────────────
create policy "anyone_select_active_plans" on plans
  for select using (is_active = true);

-- ── businesses ───────────────────────────────────────────────────────────
create policy "owner_select_own_business" on businesses
  for select using (owner_user_id = auth.uid());

create policy "owner_update_own_business" on businesses
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- ── locations ────────────────────────────────────────────────────────────
create policy "owner_select_own_locations" on locations
  for select using (business_id in (select auth_user_business_ids()));

create policy "owner_update_own_locations" on locations
  for update using (business_id in (select auth_user_business_ids()));

-- ── services ─────────────────────────────────────────────────────────────
create policy "owner_select_own_services" on services
  for select using (business_id in (select auth_user_business_ids()));

create policy "owner_insert_own_services" on services
  for insert with check (business_id in (select auth_user_business_ids()));

create policy "owner_update_own_services" on services
  for update using (business_id in (select auth_user_business_ids()));

create policy "owner_delete_own_services" on services
  for delete using (business_id in (select auth_user_business_ids()));

-- ── faqs ─────────────────────────────────────────────────────────────────
create policy "owner_select_own_faqs" on faqs
  for select using (business_id in (select auth_user_business_ids()));

create policy "owner_insert_own_faqs" on faqs
  for insert with check (business_id in (select auth_user_business_ids()));

create policy "owner_update_own_faqs" on faqs
  for update using (business_id in (select auth_user_business_ids()));

create policy "owner_delete_own_faqs" on faqs
  for delete using (business_id in (select auth_user_business_ids()));

-- ── customers ────────────────────────────────────────────────────────────
create policy "owner_select_own_customers" on customers
  for select using (business_id in (select auth_user_business_ids()));

create policy "owner_insert_own_customers" on customers
  for insert with check (business_id in (select auth_user_business_ids()));

create policy "owner_update_own_customers" on customers
  for update using (business_id in (select auth_user_business_ids()));

create policy "owner_delete_own_customers" on customers
  for delete using (business_id in (select auth_user_business_ids()));

-- ── appointments (read + status update; AI creates via service_role) ─────
create policy "owner_select_own_appointments" on appointments
  for select using (business_id in (select auth_user_business_ids()));

create policy "owner_update_own_appointments" on appointments
  for update using (business_id in (select auth_user_business_ids()));

-- ── subscriptions (read-only for owners) ─────────────────────────────────
create policy "owner_select_own_subscription" on subscriptions
  for select using (business_id in (select auth_user_business_ids()));

-- ── call_logs (read-only for owners) ──────────────────────────────────────
create policy "owner_select_own_call_logs" on call_logs
  for select using (business_id in (select auth_user_business_ids()));

-- ── call_transcripts (read via call_logs ownership) ──────────────────────
create policy "owner_select_own_transcripts" on call_transcripts
  for select using (
    call_log_id in (
      select id from call_logs
      where business_id in (select auth_user_business_ids())
    )
  );

-- ── leads ────────────────────────────────────────────────────────────────
create policy "owner_select_own_leads" on leads
  for select using (business_id in (select auth_user_business_ids()));

create policy "owner_update_own_leads" on leads
  for update using (business_id in (select auth_user_business_ids()));

-- ── daily_stats (read-only for owners) ───────────────────────────────────
create policy "owner_select_own_daily_stats" on daily_stats
  for select using (business_id in (select auth_user_business_ids()));

-- ── audit_logs (owners see their own business audit trail) ───────────────
create policy "owner_select_own_audit_logs" on audit_logs
  for select using (business_id in (select auth_user_business_ids()));

-- ═══════════════════════════════════════════════════════════════════════
-- NOTES:
-- - Platform admin routes use service_role (bypasses all RLS).
-- - Vapi/Stripe webhooks and cron jobs use service_role.
-- - Client dashboards use anon key + user JWT (RLS enforced).
-- - Sensitive columns (twilio_*_enc) are never selected by client routes.
-- ═══════════════════════════════════════════════════════════════════════
