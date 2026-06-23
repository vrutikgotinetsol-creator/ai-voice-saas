# Complete Vapi Connection Fix — Step by Step

## Why calls cut when checking availability

The call drops at `check_availability` because:

1. Your 3 tools still point to the OLD URL (ai-receptionist-uetv.onrender.com)
2. Your phone number points to the NEW URL (ai-voice-saas-a7d6.onrender.com)
3. The new backend returns "Not found" because PUBLIC_API_URL=localhost in .env
4. Even if it hits the right server, no `locations` row exists yet linking your
   Vapi phone number ID to a business — so the AI gets no prompt or tools

## Fix order (do these in sequence)

───────────────────────────────────────────────────────────────────────────────
STEP 1 — Fix Render environment variables (5 minutes)
───────────────────────────────────────────────────────────────────────────────

Go to: render.com → ai-voice-saas-a7d6 → Environment

Change these values:
  NODE_ENV          → production
  PORT              → 10000   (Render uses 10000 by default, or leave as 3000)
  PUBLIC_API_URL    → https://ai-voice-saas-a7d6.onrender.com   ← CRITICAL FIX

Add if missing:
  SUPABASE_URL      → https://eyfdpxltrvjrcbslswzg.supabase.co
  SUPABASE_SERVICE_ROLE_KEY → (your service role key from .env)
  SUPABASE_ANON_KEY → (your anon key from .env)
  GOOGLE_CLIENT_EMAIL → firebase-adminsdk-fbsvc@demochat-485c2.iam.gserviceaccount.com
  GOOGLE_PRIVATE_KEY  → (your private key — paste the full multiline value)

Save → Render will redeploy automatically.

After deploy: visit https://ai-voice-saas-a7d6.onrender.com/health
You should see: {"ok":true,"ts":"..."}
If you see {"error":"Not found"} → check Render logs for startup crash.

───────────────────────────────────────────────────────────────────────────────
STEP 2 — Run the Supabase SQL to create your first business + location
───────────────────────────────────────────────────────────────────────────────

Go to: supabase.com → your project → SQL Editor → New Query

Paste and run setup_supabase.sql (the file provided).
Fill in the UUIDs as instructed in the comments.

The critical row is the `locations` row with:
  vapi_phone_number_id = '5cc793bb-85ac-4baa-a6e2-f609e6a83317'

Run the verify query at the bottom — it must return 1 row.

───────────────────────────────────────────────────────────────────────────────
STEP 3 — Fix the 3 Tool Server URLs in Vapi (2 minutes)
───────────────────────────────────────────────────────────────────────────────

Go to: dashboard.vapi.ai → Tools

For each of the 3 tools (check_availability, book_appointment, cancel_appointment):
  1. Click the tool
  2. Scroll to "Server Settings" → "Server URL"
  3. Change from:
       https://ai-receptionist-uetv.onrender.com/webhook/vapi
  4. Change to:
       https://ai-voice-saas-a7d6.onrender.com/webhook/vapi
  5. Click Save (top right)

Repeat for all 3 tools.

───────────────────────────────────────────────────────────────────────────────
STEP 4 — Clear the Vapi assistant system prompt (1 minute)
───────────────────────────────────────────────────────────────────────────────

Go to: dashboard.vapi.ai → Assistants → Appointment Receptionist → Assistant tab

System Prompt field:
  → Select ALL the text → Delete it → leave the field EMPTY
  (Your backend now builds the prompt dynamically from Supabase on every call)

First Message field:
  → Leave as is OR change to: "Hi, thank you for calling. How can I help you today?"

Click Save → Click Publish

───────────────────────────────────────────────────────────────────────────────
STEP 5 — Verify phone number Server URL (already set, just confirm)
───────────────────────────────────────────────────────────────────────────────

Go to: dashboard.vapi.ai → Phone Numbers → +1 (424) 699 3691

Server URL should be:
  https://ai-voice-saas-a7d6.onrender.com/webhook/vapi

It already shows this from your screenshot — just confirm it's saved.

───────────────────────────────────────────────────────────────────────────────
STEP 6 — Test call
───────────────────────────────────────────────────────────────────────────────

Call +1 (424) 699 3691.

What should happen:
  - Vapi sends assistant-request to your backend
  - Backend looks up the location by phone number ID (5cc793bb-...)
  - Finds your business → builds dynamic prompt with your services/hours/FAQs
  - Returns assistant config to Vapi
  - AI answers: "Thank you for calling Glow Beauty Salon. This is Riya..."
  - When you ask to book, it calls check_availability → your backend checks
    Google Calendar (or mock slots if calendar_id is empty) → returns slots
  - You pick a slot → it calls book_appointment → saves to Supabase appointments table

If the call is STILL silent/dropping:
  → Check Render logs for errors during the call
  → Check Vapi Logs tab → click the failed call → look at the tool call response

───────────────────────────────────────────────────────────────────────────────
STEP 7 — Google Calendar (do this when ready for real bookings)
───────────────────────────────────────────────────────────────────────────────

Until you complete this, the system uses MOCK SLOTS (fake availability).
Mock slots let you test the full call flow without Calendar setup.
Real slots require:

1. Go to console.cloud.google.com → select project demochat-485c2
2. APIs & Services → Library → Search "Google Calendar API" → Enable it
3. That's all for the service account — the existing key already works once
   the API is enabled on the project
4. For each client's calendar:
   a. calendar.google.com → Settings for the calendar (⚙ icon)
   b. Share with specific people → Add:
      firebase-adminsdk-fbsvc@demochat-485c2.iam.gserviceaccount.com
   c. Permission: "Make changes to events" → Save
   d. In Settings → "Integrate calendar" section → copy the Calendar ID
      (looks like: abc123@group.calendar.google.com or a Gmail address)
   e. Go to Supabase → locations table → update calendar_id for that location
      UPDATE locations SET calendar_id = 'abc123@group.calendar.google.com'
      WHERE id = 'YOUR-LOCATION-UUID';

───────────────────────────────────────────────────────────────────────────────
QUICK DIAGNOSTIC CHECKLIST
───────────────────────────────────────────────────────────────────────────────

□ https://ai-voice-saas-a7d6.onrender.com/health returns {"ok":true}
□ Supabase: locations row exists with vapi_phone_number_id = '5cc793bb-...'
□ Supabase: that location has a linked businesses row with status = 'trial'
□ Supabase: services rows exist for that business_id
□ Vapi: all 3 tools Server URL = https://ai-voice-saas-a7d6.onrender.com/webhook/vapi
□ Vapi: phone number Server URL = https://ai-voice-saas-a7d6.onrender.com/webhook/vapi
□ Vapi: assistant System Prompt field is EMPTY
□ Render: PUBLIC_API_URL = https://ai-voice-saas-a7d6.onrender.com (NOT localhost)
□ Render: all SUPABASE_* env vars are set
