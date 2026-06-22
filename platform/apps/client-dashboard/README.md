# Client Dashboard

Business owner dashboard for managing appointments, customers, leads, and AI receptionist settings.

## Stack

React 18 · Vite · TypeScript · Tailwind · shadcn/ui · TanStack Query · FullCalendar · Recharts

## Setup

```bash
cd platform
npm install

cp apps/client-dashboard/.env.example apps/client-dashboard/.env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

# Terminal 1 — API
npm run dev:api

# Terminal 2 — Client dashboard
npm run dev:client
# → http://localhost:5174
```

## Pages

| Route | Module |
|-------|--------|
| `/` | Home — stats, charts, upcoming appointments |
| `/appointments` | List with filters and status actions |
| `/calendar` | FullCalendar with drag-and-drop reschedule |
| `/customers` | CRM list |
| `/customers/:id` | Customer history |
| `/leads` | Lead pipeline |
| `/calls` | Call logs |
| `/analytics` | AI performance metrics |
| `/billing` | Subscription + Stripe portal |
| `/settings` | Business info, hours, services, FAQs |

**Note:** Technical settings (Vapi IDs, Twilio creds, API keys, prompts) are hidden — managed by platform admin only.
