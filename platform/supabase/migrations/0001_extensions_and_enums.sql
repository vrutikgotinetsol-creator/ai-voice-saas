-- ═══════════════════════════════════════════════════════════════════════
-- AI Receptionist SaaS — Extensions & Enums
-- Migration 0001
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- Business lifecycle
create type business_status as enum (
  'pending',
  'trial',
  'active',
  'suspended',
  'cancelled'
);

-- Appointment lifecycle
create type appointment_status as enum (
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
);

-- Subscription lifecycle (matches Stripe states)
create type subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete'
);

-- Lead pipeline
create type lead_status as enum (
  'new',
  'contacted',
  'won',
  'lost'
);

-- Call outcome taxonomy
create type call_outcome as enum (
  'appointment_booked',
  'faq_answered',
  'lead_captured',
  'appointment_cancelled',
  'no_action'
);

-- Audit actor types
create type audit_actor_type as enum (
  'platform_admin',
  'business_owner',
  'system',
  'webhook'
);
