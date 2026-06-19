import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, Clock, Ban, DollarSign, Phone, Calendar, TrendingUp } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardPage() {
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.getStats });
  const trendsQuery = useQuery({ queryKey: ['admin-trends'], queryFn: adminApi.getTrends });

  const stats = statsQuery.data;
  const trends = trendsQuery.data ?? [];

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and performance metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Clients" value={stats?.totalClients ?? 0} icon={Users} />
        <StatCard title="Active Clients" value={stats?.activeClients ?? 0} icon={UserCheck} />
        <StatCard title="Trial Clients" value={stats?.trialClients ?? 0} icon={Clock} />
        <StatCard title="Suspended" value={stats?.suspendedClients ?? 0} icon={Ban} />
        <StatCard
          title="Monthly Revenue"
          value={`$${(stats?.mrr ?? 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard title="Total Calls" value={stats?.totalCalls ?? 0} icon={Phone} />
        <StatCard title="Appointments (30d)" value={stats?.totalAppointments ?? 0} icon={Calendar} />
        <StatCard
          title="AI Booking Rate"
          value={`${stats?.aiBookingRate ?? 0}%`}
          icon={TrendingUp}
          subtitle="Calls resulting in bookings"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {trendsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[320px]" />)
        ) : (
          <>
            <TrendChart
              title="Revenue Trend"
              data={trends}
              dataKey="revenue"
              color="#a78bfa"
              valueFormatter={(v) => `$${v.toFixed(2)}`}
            />
            <TrendChart title="Appointment Trend" data={trends} dataKey="appointments" color="#34d399" />
            <TrendChart title="Call Trend" data={trends} dataKey="calls" color="#60a5fa" />
          </>
        )}
      </div>
    </div>
  );
}
