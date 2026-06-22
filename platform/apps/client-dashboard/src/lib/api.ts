import type { Appointment, Business, Customer, Lead, Service, Faq, Location } from '@platform/shared-types';
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

export interface ClientStats {
  appointmentsToday: number;
  callsToday: number;
  revenueTodayCents: number;
  revenueMonthCents: number;
  appointmentsThisMonth: number;
  upcomingAppointments: Appointment[];
}

export interface TrendPoint {
  date: string;
  appointments: number;
  calls: number;
  revenue: number;
}

export interface Analytics {
  callsAnswered: number;
  callsMissed: number;
  bookings: number;
  cancellations: number;
  conversionRate: number;
  avgCallDurationSec: number;
  totalCalls: number;
}

export interface CallLog {
  id: string;
  duration_sec: number | null;
  outcome: string | null;
  summary: string | null;
  sentiment: string | null;
  customer_phone: string | null;
  created_at: string;
}

export interface BusinessProfile extends Business {
  services?: Service[];
  faqs?: Faq[];
  locations?: Location[];
  subscriptions?: { status: string; amount_cents: number; plans?: { name: string; slug: string } };
}

export interface CustomerDetail extends Customer {
  appointments?: Appointment[];
}

export interface SubscriptionInfo {
  status: string;
  amount_cents: number;
  businessStatus?: string;
  trialDaysLeft?: number | null;
  plans?: { name: string; slug: string; amount_cents: number };
  current_period_end?: string | null;
}

export const clientApi = {
  getBusiness: () => apiFetch<BusinessProfile>('/api/client/me/business'),
  updateBusiness: (data: Record<string, unknown>) =>
    apiFetch('/api/client/me/business', { method: 'PUT', body: JSON.stringify(data) }),
  getStats: () => apiFetch<ClientStats>('/api/client/me/stats'),
  getTrends: () => apiFetch<TrendPoint[]>('/api/client/me/stats/trends'),
  getAnalytics: () => apiFetch<Analytics>('/api/client/me/analytics'),
  getAppointments: (params?: { status?: string; date?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.date) q.set('date', params.date);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return apiFetch<Appointment[]>(`/api/client/me/appointments${qs ? `?${qs}` : ''}`);
  },
  updateAppointment: (id: string, data: { status?: string; start_time?: string }) =>
    apiFetch<Appointment>(`/api/client/me/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getCustomers: (search?: string) =>
    apiFetch<Customer[]>(`/api/client/me/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getCustomer: (id: string) => apiFetch<CustomerDetail>(`/api/client/me/customers/${id}`),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    apiFetch(`/api/client/me/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLeads: (status?: string) =>
    apiFetch<Lead[]>(`/api/client/me/leads${status ? `?status=${status}` : ''}`),
  updateLead: (id: string, data: Partial<Lead>) =>
    apiFetch(`/api/client/me/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getCalls: () => apiFetch<CallLog[]>('/api/client/me/calls'),
  getSubscription: () => apiFetch<SubscriptionInfo>('/api/client/me/subscription'),
  getServices: () => apiFetch<Service[]>('/api/client/me/services'),
  createService: (data: Partial<Service>) =>
    apiFetch('/api/client/me/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: Partial<Service>) =>
    apiFetch(`/api/client/me/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteService: (id: string) => apiFetch(`/api/client/me/services/${id}`, { method: 'DELETE' }),
  getFaqs: () => apiFetch<Faq[]>('/api/client/me/faqs'),
  createFaq: (data: Partial<Faq>) =>
    apiFetch('/api/client/me/faqs', { method: 'POST', body: JSON.stringify(data) }),
  updateFaq: (id: string, data: Partial<Faq>) =>
    apiFetch(`/api/client/me/faqs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFaq: (id: string) => apiFetch(`/api/client/me/faqs/${id}`, { method: 'DELETE' }),
  updateLocation: (id: string, data: Partial<Location>) =>
    apiFetch(`/api/client/me/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  checkout: (planSlug: string) =>
    apiFetch<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planSlug }),
    }),
  billingPortal: () => apiFetch<{ url: string }>('/api/billing/portal', { method: 'POST' }),
};
