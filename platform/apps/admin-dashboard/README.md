# Admin Dashboard

Platform owner dashboard for managing AI Receptionist clients.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui components
- TanStack Query + React Router
- Recharts
- Supabase Auth

## Setup

```bash
cd platform
npm install

cp apps/admin-dashboard/.env.example apps/admin-dashboard/.env
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

# Start API (terminal 1)
npm run dev:api

# Start admin dashboard (terminal 2)
npm run dev:admin
# → http://localhost:5173
```

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Platform admin sign-in |
| `/` | Dashboard overview + trend charts |
| `/clients` | Client list with actions |
| `/clients/new` | Onboard new client |
| `/clients/:id` | Client detail + metrics |
| `/billing` | Subscription overview + MRR |

## Admin access

Your Supabase Auth user must exist in the `platform_admins` table. See `supabase/README.md`.
