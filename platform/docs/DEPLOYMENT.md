# Deployment Guide

Production deployment for the AI Receptionist SaaS platform.

| Component | Host | URL example |
|-----------|------|-------------|
| Database + Auth | Supabase | `https://xxxx.supabase.co` |
| API | Render (Docker) | `https://api.yourdomain.com` |
| Admin Dashboard | Vercel | `https://admin.yourdomain.com` |
| Client Dashboard | Vercel | `https://app.yourdomain.com` |
| Voice AI | Vapi | Webhook → API `/webhook/vapi` |
| Payments | Stripe | Webhook → API `/webhook/stripe` |

---

## Prerequisites

- [Supabase](https://supabase.com) project
- [Render](https://render.com) account
- [Vercel](https://vercel.com) account (two projects: admin + client)
- [Stripe](https://stripe.com) account with products/prices configured
- [Vapi](https://vapi.ai) account with phone numbers
- [Google Cloud](https://console.cloud.google.com) service account for Calendar API (optional)
- Domain names (optional but recommended)

---

## Step 1: Supabase

### Apply migrations

```bash
cd platform
npm install -g supabase

supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or run SQL files manually in **Supabase Dashboard → SQL Editor** (in order):

1. `supabase/migrations/0001_extensions_and_enums.sql`
2. `supabase/migrations/0002_core_tables.sql`
3. `supabase/migrations/0003_triggers_and_functions.sql`
4. `supabase/migrations/0004_rls_policies.sql`

### Create platform admin

1. **Authentication → Users → Add user** (email + password)
2. Run in SQL Editor:

```sql
insert into platform_admins (id, email, full_name)
values ('PASTE_AUTH_USER_UUID', 'admin@yourdomain.com', 'Platform Admin');
```

### Collect credentials

From **Project Settings → API**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (for frontends)
- `SUPABASE_SERVICE_ROLE_KEY` (API only — never in Vercel)

### Configure Auth redirect URLs

**Authentication → URL Configuration**:

- Site URL: `https://app.yourdomain.com`
- Redirect URLs: `https://admin.yourdomain.com/**`, `https://app.yourdomain.com/**`, `http://localhost:5173/**`, `http://localhost:5174/**`

---

## Step 2: Stripe

1. Create three products/prices: Starter ($99), Professional ($199), Enterprise ($499)
2. Copy price IDs → `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE`
3. Copy **Secret key** → `STRIPE_SECRET_KEY`
4. Create webhook endpoint (after API is deployed):
   - URL: `https://api.yourdomain.com/webhook/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

---

## Step 3: API on Render

### Option A: Blueprint (recommended)

1. Push `platform/` to GitHub
2. [Render Dashboard](https://dashboard.render.com) → **New → Blueprint**
3. Connect repo; Render reads `render.yaml`
4. Set secret env vars when prompted (see `.env.example`)

### Option B: Manual Docker service

1. **New → Web Service** → connect repo
2. Settings:
   - **Root Directory:** `platform` (if repo contains parent folder)
   - **Runtime:** Docker
   - **Dockerfile Path:** `apps/api/Dockerfile`
   - **Docker Context:** `.`
   - **Health Check Path:** `/health`
3. Add environment variables from `apps/api/.env.example`

### Required API environment variables

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `CORS_ORIGINS` | `https://admin.yourdomain.com,https://app.yourdomain.com` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `ENCRYPTION_KEY` | 32+ char random string |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_*` | Stripe price IDs |

### Custom domain

Render → your service → **Settings → Custom Domains** → add `api.yourdomain.com`

---

## Step 4: Admin Dashboard on Vercel

1. [Vercel Dashboard](https://vercel.com) → **Add New Project**
2. Import Git repo
3. Configure:
   - **Root Directory:** `platform/apps/admin-dashboard`
   - **Framework Preset:** Vite (auto-detected via `vercel.json`)
4. Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | `https://api.yourdomain.com` |

5. Deploy → add custom domain `admin.yourdomain.com`

---

## Step 5: Client Dashboard on Vercel

Repeat Step 4 with:

- **Root Directory:** `platform/apps/client-dashboard`
- Same env vars as admin
- Custom domain: `app.yourdomain.com`

---

## Step 6: Vapi webhooks

In [Vapi Dashboard](https://dashboard.vapi.ai):

1. Set **Server URL** for your assistant/phone number:
   - `https://api.yourdomain.com/webhook/vapi`
2. Tool calls route automatically via `PUBLIC_API_URL` env var

When onboarding clients in admin dashboard, assign each location's `vapi_phone_number_id`.

---

## Step 7: Google Calendar (optional)

1. Create GCP service account with Calendar API enabled
2. Share each client's Google Calendar with the service account email
3. Set `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` on the API

---

## Local Docker (API only)

```bash
cd platform
cp apps/api/.env.example apps/api/.env   # fill in values
docker compose up --build
# API → http://localhost:3001/health
```

Frontends still run via Vite for hot reload:

```bash
npm run dev:admin    # :5173
npm run dev:client   # :5174
```

---

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

On every push/PR to `main`:

1. `npm ci` + full typecheck
2. Build admin + client dashboards
3. Build and smoke-test API Docker image

Enable by pushing the `platform/` folder to GitHub with the workflow file included.

---

## Post-deploy checklist

- [ ] Supabase migrations applied
- [ ] Platform admin user created
- [ ] API `/health` returns `{ "status": "ok" }`
- [ ] Admin login works at admin URL
- [ ] Create test client via admin onboarding
- [ ] Client login works at app URL
- [ ] Stripe webhook receiving events (Stripe Dashboard → Webhooks)
- [ ] Vapi test call routes to correct business
- [ ] SMS reminders sending (check Twilio logs)
- [ ] CORS allows both frontend domains

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors | Verify `CORS_ORIGINS` includes exact frontend URLs (no trailing slash) |
| 401 on API calls | Check Supabase JWT; user must be in `platform_admins` or own a business |
| Stripe webhook fails | Ensure raw body route is used (already configured in `app.ts`) |
| Vapi fallback assistant | Location missing `vapi_phone_number_id` or business suspended |
| Encryption errors on onboarding | Set `ENCRYPTION_KEY` (32+ chars) on API before storing Twilio creds |
| Docker health check fails | Confirm `PORT=3001` and `/health` endpoint reachable |

---

## Architecture summary

```
admin.yourdomain.com  ──→  Vercel (admin-dashboard)
app.yourdomain.com    ──→  Vercel (client-dashboard)
api.yourdomain.com    ──→  Render (Docker API)
                          ├── /webhook/vapi   ← Vapi
                          ├── /webhook/stripe ← Stripe
                          └── /api/*          ← Both frontends
                                    │
                                    ▼
                          Supabase Postgres + Auth (RLS)
```
