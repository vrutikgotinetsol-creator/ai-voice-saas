# Supabase Migrations

Database schema for the AI Receptionist SaaS platform.

## Apply migrations

### Option A: Supabase CLI (recommended)

```bash
# From platform/ directory
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

### Option B: SQL Editor

Run each file in order in the Supabase Dashboard → SQL Editor:

1. `0001_extensions_and_enums.sql`
2. `0002_core_tables.sql`
3. `0003_triggers_and_functions.sql`
4. `0004_rls_policies.sql`

## Create platform admin

After migrations, create your admin user:

```sql
-- 1. Create user in Supabase Auth (Dashboard → Authentication → Users)
-- 2. Then insert into platform_admins:
insert into platform_admins (id, email, full_name)
values ('YOUR_AUTH_USER_UUID', 'admin@yourdomain.com', 'Platform Admin');
```

## Schema overview

| Table | Purpose |
|-------|---------|
| `platform_admins` | Platform owner/staff |
| `plans` | Subscription tiers (Starter, Professional, Enterprise) |
| `businesses` | Tenant root (org-level) |
| `locations` | Multi-location: phone, calendar, hours per site |
| `services` | Pricing menu |
| `faqs` | AI knowledge base |
| `customers` | CRM |
| `appointments` | Bookings |
| `subscriptions` | Stripe billing state |
| `call_logs` | Vapi call metadata |
| `call_transcripts` | Full transcripts |
| `leads` | Non-booking captures |
| `daily_stats` | Pre-aggregated analytics |
| `audit_logs` | Security audit trail |

## Multi-tenant isolation

- **Client dashboards**: Supabase anon key + user JWT → RLS enforced
- **Admin API / webhooks / cron**: service_role key → bypasses RLS (server-side only)

## Encrypted fields

Twilio credentials are stored encrypted in `locations`:
- `twilio_account_sid_enc`
- `twilio_auth_token_enc`

Encryption uses `ENCRYPTION_KEY` on the API server (AES-256-GCM).
