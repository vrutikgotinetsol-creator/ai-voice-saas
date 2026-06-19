-- ═══════════════════════════════════════════════════════════════════════
-- AI Receptionist SaaS — Triggers & Helper Functions
-- Migration 0003
-- ═══════════════════════════════════════════════════════════════════════

-- Auto-touch updated_at
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

create trigger trg_locations_updated_at
  before update on locations
  for each row execute function set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

create trigger trg_customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

create trigger trg_plans_updated_at
  before update on plans
  for each row execute function set_updated_at();

create trigger trg_daily_stats_updated_at
  before update on daily_stats
  for each row execute function set_updated_at();

-- Ensure only one primary location per business
create or replace function enforce_single_primary_location()
returns trigger as $$
begin
  if new.is_primary then
    update locations
    set is_primary = false
    where business_id = new.business_id
      and id != new.id
      and is_primary = true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_locations_single_primary
  before insert or update of is_primary on locations
  for each row
  when (new.is_primary = true)
  execute function enforce_single_primary_location();

-- Upsert customer on appointment insert
create or replace function upsert_customer_on_appointment()
returns trigger as $$
declare
  v_customer_id uuid;
begin
  insert into customers (business_id, name, phone)
  values (new.business_id, new.customer_name, new.customer_phone)
  on conflict (business_id, phone) do update
    set name = excluded.name,
        updated_at = now()
  returning id into v_customer_id;

  new.customer_id := v_customer_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_appointments_upsert_customer
  before insert on appointments
  for each row execute function upsert_customer_on_appointment();

-- Update customer stats after appointment changes
create or replace function refresh_customer_stats()
returns trigger as $$
declare
  v_customer_id uuid;
  v_business_id uuid;
begin
  v_customer_id := coalesce(new.customer_id, old.customer_id);
  v_business_id := coalesce(new.business_id, old.business_id);

  if v_customer_id is null then
    return coalesce(new, old);
  end if;

  update customers c
  set
    total_appointments = (
      select count(*) from appointments a
      where a.customer_id = v_customer_id
        and a.status in ('confirmed', 'completed')
    ),
    lifetime_value_cents = (
      select coalesce(sum(
        case
          when a.price_label ~ '^\$?([0-9]+(\.[0-9]{1,2})?)'
          then (regexp_replace(a.price_label, '[^0-9.]', '', 'g'))::numeric * 100
          else 0
        end
      ), 0)::int
      from appointments a
      where a.customer_id = v_customer_id
        and a.status = 'completed'
    ),
    last_visit_at = (
      select max(a.start_time) from appointments a
      where a.customer_id = v_customer_id
        and a.status = 'completed'
    ),
    updated_at = now()
  where c.id = v_customer_id and c.business_id = v_business_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_appointments_refresh_customer_stats
  after insert or update of status on appointments
  for each row execute function refresh_customer_stats();

-- Helper: check if current user owns a business
create or replace function auth_user_owns_business(p_business_id uuid)
returns boolean as $$
  select exists (
    select 1 from businesses
    where id = p_business_id and owner_user_id = auth.uid()
  );
$$ language sql stable security definer;

-- Helper: get business ids for current user
create or replace function auth_user_business_ids()
returns setof uuid as $$
  select id from businesses where owner_user_id = auth.uid();
$$ language sql stable security definer;
