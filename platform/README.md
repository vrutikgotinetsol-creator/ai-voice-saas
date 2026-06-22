# AI Receptionist SaaS Platform

Production-ready multi-tenant AI Receptionist SaaS for salons, clinics, dentists, spas, and service businesses.

## Monorepo structure

```
platform/
├── apps/
│   ├── api/                 # Node.js + Express API (TypeScript)
│   ├── admin-dashboard/     ✅ Platform admin UI
│   └── client-dashboard/    ✅ Business owner UI
├── packages/
│   ├── shared-types/        # Shared TypeScript types
│   └── shared-ui/           # Shared UI components (Phase 2+)
├── supabase/
│   └── migrations/          # Database schema + RLS
└── docs/
    └── ARCHITECTURE.md
```

## Build status

### Phase 1 — Database + Backend ✅
- Supabase schema (15 tables), RLS, multi-location
- TypeScript Express API, Vapi/Stripe/Twilio integrations

### Phase 2 — Admin Dashboard ✅
- Client management, onboarding, billing overview, trend charts

### Phase 3 — Client Dashboard ✅
- Appointments, FullCalendar, CRM, leads, calls, AI analytics, billing, settings

### Phase 4 — Deployment ✅
- Docker, Render Blueprint, Vercel configs, GitHub Actions CI
- See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Quick start

```bash
cd platform
npm install

cp apps/api/.env.example apps/api/.env
cp apps/admin-dashboard/.env.example apps/admin-dashboard/.env
cp apps/client-dashboard/.env.example apps/client-dashboard/.env

# Apply migrations (see supabase/README.md)

# Terminal 1 — API
npm run dev:api

# Terminal 2 — Admin (port 5173)
npm run dev:admin

# Terminal 3 — Client (port 5174)
npm run dev:client
```

## API routes

| Prefix | Auth | Description |
|--------|------|-------------|
| `GET /health` | None | Health check |
| `/api/admin/*` | Platform admin JWT | Client management, stats, billing overview |
| `/api/client/*` | Business owner JWT | Appointments, customers, leads, calls |
| `/api/billing/*` | Business owner JWT | Stripe Checkout + Portal |
| `/webhook/vapi` | Vapi | AI assistant + tool calls |
| `/webhook/stripe` | Stripe signature | Subscription sync |

## Build phases

1. ✅ Database + Backend API
2. ✅ Admin Dashboard
3. ✅ Client Dashboard
4. ✅ Deployment — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Deployment quick links

| File | Purpose |
|------|---------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Full step-by-step deploy guide |
| [render.yaml](render.yaml) | Render Blueprint for API |
| [docker-compose.yml](docker-compose.yml) | Local API via Docker |
| [apps/api/Dockerfile](apps/api/Dockerfile) | Production API container |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | GitHub Actions CI |
| [apps/admin-dashboard/vercel.json](apps/admin-dashboard/vercel.json) | Vercel config (admin) |
| [apps/client-dashboard/vercel.json](apps/client-dashboard/vercel.json) | Vercel config (client) |

## Legacy files

Original prototype files remain in the parent `ai-saas/` directory for reference. The production codebase lives under `platform/`.
