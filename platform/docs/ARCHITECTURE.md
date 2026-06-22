# AI Receptionist SaaS — Architecture

> Updated for production monorepo under `platform/`. See [Phase 1 README](../README.md).

## System overview

```
                    ┌─────────────────────────────┐
                    │   ADMIN DASHBOARD            │
                    │   (platform owner)           │
                    │   service_role via API       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   SUPABASE POSTGRES          │
                    │   Row Level Security         │
                    └──────────────┬──────────────┘
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
┌──────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│ CLIENT DASHBOARD A  │  │ CLIENT DASHBOARD B │  │  EXPRESS API       │
│ (RLS + user JWT)    │  │ (RLS + user JWT)   │  │  webhooks + cron   │
└─────────────────────┘  └────────────────────┘  └─────────┬─────────┘
                                                            │
                              ┌─────────────────────────────┼─────────────┐
                              │                             │             │
                         ┌────▼────┐                  ┌─────▼─────┐  ┌───▼───┐
                         │  Vapi   │                  │  Stripe   │  │Twilio │
                         └─────────┘                  └───────────┘  └───────┘
```

## Monorepo layout

```
platform/
├── apps/
│   ├── api/                    # Express + TypeScript backend
│   ├── admin-dashboard/        # Phase 2
│   └── client-dashboard/       # Phase 3
├── packages/
│   ├── shared-types/           # DB + API types
│   └── shared-ui/              # Phase 2+
├── supabase/migrations/        # Schema + RLS
└── docs/ARCHITECTURE.md
```

## Backend architecture (Phase 1)

```
apps/api/src/
├── config/env.ts           # Validated environment
├── lib/
│   ├── supabase.ts         # Admin + user-scoped clients
│   ├── encryption.ts       # Twilio credential encryption
│   ├── prompt.ts           # Dynamic AI prompts from DB
│   ├── calendar.ts         # Google Calendar integration
│   └── sms.ts              # Twilio SMS
├── middleware/
│   ├── auth.ts             # JWT + role guards
│   ├── rateLimit.ts        # Rate limiting
│   └── errorHandler.ts
├── routes/
│   ├── admin/              # Platform admin CRUD
│   ├── client/             # Business owner API
│   ├── billing/            # Stripe Checkout/Portal
│   └── webhooks/           # Vapi + Stripe
├── services/
│   └── audit.service.ts    # Audit logging
├── cron/
│   └── reminder.cron.ts    # 24h + 2h SMS reminders
├── app.ts
└── index.ts
```

## Database schema (15 tables)

| Table | Tenant key | Notes |
|-------|-----------|-------|
| `platform_admins` | — | Platform staff |
| `plans` | — | Starter / Professional / Enterprise |
| `businesses` | `owner_user_id` | Tenant root |
| `locations` | `business_id` | Multi-location phone/calendar/hours |
| `services` | `business_id` | Pricing menu |
| `faqs` | `business_id` | AI knowledge |
| `customers` | `business_id` | CRM |
| `appointments` | `business_id` | Bookings |
| `subscriptions` | `business_id` | Stripe state |
| `call_logs` | `business_id` | Call metadata |
| `call_transcripts` | via `call_log_id` | Full transcripts |
| `leads` | `business_id` | Non-booking captures |
| `daily_stats` | `business_id` | Analytics aggregates |
| `audit_logs` | `business_id` | Security trail |

## Multi-tenant security

- **RLS** on all tenant tables via `auth_user_business_ids()` helper
- **Client API** uses anon key + user JWT → database enforces isolation
- **Admin API / webhooks / cron** use service_role → server-side only
- **Twilio credentials** encrypted at rest (`twilio_*_enc` columns)
- **Sensitive fields** never returned to client dashboard routes

## Vapi tool functions

| Tool | Purpose |
|------|---------|
| `check_availability` | Query Google Calendar free/busy |
| `book_appointment` | Create appointment + calendar event + SMS |
| `cancel_appointment` | Cancel + remove calendar event + SMS |
| `capture_lead` | Store non-booking caller info |
| `lookup_customer` | Return customer history by phone |

Phone routing: `locations.vapi_phone_number_id` → business + location context.

## Build phases

1. ✅ Database + Backend API
2. ✅ Admin Dashboard
3. ✅ Client Dashboard
4. ✅ Deployment (Docker, CI/CD, Vercel/Render)

## Legacy reference

Original prototype files (`supabase.js`, `auth.js`, `vapiWebhook.js`, etc.) remain in the parent `ai-saas/` directory. Production code is under `platform/`.
