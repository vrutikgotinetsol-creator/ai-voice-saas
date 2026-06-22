import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { CallsPage } from '@/pages/CallsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { BillingPage } from '@/pages/BillingPage';
import { SettingsPage } from '@/pages/SettingsPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
              <Route index element={<HomePage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="calls" element={<CallsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
