-- ═══════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR
-- This sets up your first client so calls work immediately
-- ═══════════════════════════════════════════════════════════════════════

-- ── STEP 1: Create your platform admin account ───────────────────────────────
-- First, sign up manually in Supabase Auth (Dashboard → Authentication → Users
-- → Add user) with YOUR email and password, then get the UUID and paste below.
-- Then run this INSERT:
--
-- insert into platform_admins (id, email, full_name)
-- values ('YOUR-AUTH-USER-UUID-HERE', 'your@email.com', 'Your Name');


-- ── STEP 2: Create a test business + location ────────────────────────────────
-- Run this to create a demo business you can test with immediately.
-- Replace the values with your actual test client's details.

insert into businesses (
  name,
  business_type,
  agent_name,
  voice_id,
  timezone,
  extra_info,
  status,
  trial_started_at
) values (
  'Glow Beauty Salon',
  'hair and beauty salon',
  'Riya',
  'Elliot',
  'America/New_York',
  'We speak English and Hindi. Walk-ins welcome based on availability.',
  'trial',
  now()
) returning id;
-- ↑ Copy the returned UUID — you need it for the next steps


-- ── STEP 3: Create a location for that business ──────────────────────────────
-- Replace 'BUSINESS-UUID-HERE' with the UUID from Step 2
-- Replace 'VAPI-PHONE-NUMBER-ID-HERE' with: 5cc793bb-85ac-4baa-a6e2-f609e6a83317
-- (from your Vapi dashboard → Phone Numbers → click your number → copy the UUID)

insert into locations (
  business_id,
  name,
  address,
  timezone,
  hours_text,
  open_time,
  close_time,
  days_open,                     -- 1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat,0=Sun
  appointment_duration_min,
  vapi_phone_number_id,          -- THIS IS THE KEY LINK TO VAPI
  vapi_phone_number_display,
  calendar_id,                   -- Leave empty for now, add after Google Calendar setup
  is_primary,
  is_active
) values (
  'BUSINESS-UUID-HERE',
  'Main Location',
  '123 Main St, Your City',
  'America/New_York',
  'Monday to Saturday, 9 AM to 6 PM. Closed Sundays.',
  '09:00',
  '18:00',
  '{1,2,3,4,5,6}',              -- Mon through Sat
  30,
  '5cc793bb-85ac-4baa-a6e2-f609e6a83317',   -- Your Vapi phone number ID
  '+1 (424) 699 3691',
  '',                            -- Leave blank until Google Calendar is set up
  true,
  true
) returning id;
-- ↑ Copy this UUID too — it's your location_id


-- ── STEP 4: Add services for this business ────────────────────────────────────
-- Replace 'BUSINESS-UUID-HERE' with the UUID from Step 2

insert into services (business_id, name, price_label, duration_min, sort_order)
values
  ('BUSINESS-UUID-HERE', 'Haircut',           '$40',  45, 1),
  ('BUSINESS-UUID-HERE', 'Hair Color',        '$80',  90, 2),
  ('BUSINESS-UUID-HERE', 'Facial',            '$60',  60, 3),
  ('BUSINESS-UUID-HERE', 'Manicure',          '$35',  30, 4),
  ('BUSINESS-UUID-HERE', 'Pedicure',          '$45',  45, 5),
  ('BUSINESS-UUID-HERE', 'Bridal Makeup',     '$150', 120, 6);


-- ── STEP 5: Add FAQs ──────────────────────────────────────────────────────────
insert into faqs (business_id, question, answer, sort_order)
values
  ('BUSINESS-UUID-HERE', 'Do you accept walk-ins?',      'Yes, we do accept walk-ins based on availability. Booking ahead guarantees your slot.', 1),
  ('BUSINESS-UUID-HERE', 'What payment methods do you accept?', 'We accept cash, all major credit cards, and UPI.', 2),
  ('BUSINESS-UUID-HERE', 'Do you offer home service?',   'We currently only operate from our salon location.', 3);


-- ── STEP 6: Create subscription row ──────────────────────────────────────────
insert into subscriptions (business_id, status, amount_cents)
values ('BUSINESS-UUID-HERE', 'trialing', 19900);


-- ── VERIFY: Check the location is linked correctly ────────────────────────────
select
  l.id as location_id,
  l.name as location_name,
  l.vapi_phone_number_id,
  b.name as business_name,
  b.status as business_status
from locations l
join businesses b on b.id = l.business_id
where l.vapi_phone_number_id = '5cc793bb-85ac-4baa-a6e2-f609e6a83317';
-- This should return 1 row. If it does, calls will work.
-- If it returns 0 rows, the phone number ID is wrong or the insert failed.
