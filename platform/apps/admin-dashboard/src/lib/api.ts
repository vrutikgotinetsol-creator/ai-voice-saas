import type { CreateClientRequest, PlatformStats } from '@platform/shared-types';
import { getAccessToken } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export interface ClientListItem {
  id: string;
  name: string;
  business_type: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  status: string;
  trial_started_at: string | null;
  created_at: string;
  subscriptions?:
    | {
        status: string;
        amount_cents: number;
        plans?: { name: string; slug: string } | null;
      }
    | Array<{
        status: string;
        amount_cents: number;
        plans?: { name: string; slug: string } | null;
      }>;
  locations?: Array<{ vapi_phone_number_display: string | null }>;
  appointment_stats: { total: number; confirmed: number; cancelled: number };
}

export interface TrendPoint {
  date: string;
  appointments: number;
  calls: number;
  revenue: number;
}

export interface BillingOverview {
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  trialSubscriptions: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  subscriptions: Array<{
    id: string;
    status: string;
    amount_cents: number;
    businesses?: { name: string };
    plans?: { name: string; slug: string };
  }>;
}

export interface ClientDetail extends ClientListItem {
  services?: unknown[];
  faqs?: unknown[];
  appointments?: Array<{
    id: string;
    customer_name: string;
    customer_phone: string;
    service_name: string | null;
    start_time: string;
    status: string;
    price_label: string | null;
  }>;
  callLogs?: Array<{
    id: string;
    duration_sec: number | null;
    outcome: string | null;
    summary: string | null;
    created_at: string;
  }>;
  leads?: unknown[];
  customers?: unknown[];
}

export const adminApi = {
  getStats: () => apiFetch<PlatformStats>('/api/admin/stats'),
  getTrends: () => apiFetch<TrendPoint[]>('/api/admin/stats/trends'),
  getClients: () => apiFetch<ClientListItem[]>('/api/admin/clients'),
  getClient: (id: string) => apiFetch<ClientDetail>(`/api/admin/clients/${id}`),
  createClient: (data: CreateClientRequest) =>
    apiFetch<{ business: ClientListItem; ownerLogin: { email: string; password: string } }>(
      '/api/admin/clients',
      { method: 'POST', body: JSON.stringify(data) },
    ),
  updateClient: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/admin/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateClientStatus: (id: string, status: string) =>
    apiFetch(`/api/admin/clients/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteClient: (id: string) => apiFetch(`/api/admin/clients/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, newPassword: string) =>
    apiFetch(`/api/admin/clients/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  getBillingOverview: () => apiFetch<BillingOverview>('/api/admin/billing/overview'),
};
