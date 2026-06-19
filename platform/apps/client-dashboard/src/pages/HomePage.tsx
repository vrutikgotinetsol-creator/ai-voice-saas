import { useQuery } from '@tanstack/react-query';
import { Calendar, Phone, DollarSign, Clock } from 'lucide-react';
import { clientApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/StatCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function HomePage() {
  const statsQ = useQuery({ queryKey: ['client-stats'], queryFn: clientApi.getStats });
  const trendsQ = useQuery({ queryKey: ['client-trends'], queryFn: clientApi.getTrends });

  if (statsQ.isLoading) return <Skeleton className="h-96 w-full" />;

  const stats = statsQ.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your business at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Appointments Today" value={stats?.appointmentsToday ?? 0} icon={Calendar} />
        <StatCard title="Calls Today" value={stats?.callsToday ?? 0} icon={Phone} />
        <StatCard title="Revenue Today" value={formatCurrency(stats?.revenueTodayCents ?? 0)} icon={DollarSign} />
        <StatCard title="This Month" value={stats?.appointmentsThisMonth ?? 0} subtitle="appointments" icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {trendsQ.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[280px]" />)
        ) : (
          <>
            <TrendChart title="Appointments" data={trendsQ.data ?? []} dataKey="appointments" color="#34d399" />
            <TrendChart title="Calls" data={trendsQ.data ?? []} dataKey="calls" color="#60a5fa" />
            <TrendChart title="Revenue" data={trendsQ.data ?? []} dataKey="revenue" color="#a78bfa" valueFormatter={(v) => `$${v.toFixed(0)}`} />
          </>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Upcoming Appointments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(stats?.upcomingAppointments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming appointments</p>
          ) : (
            stats?.upcomingAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                <div>
                  <p className="font-medium">{a.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{a.service_name ?? 'Appointment'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{formatDateTime(a.start_time)}</p>
                  <Badge variant="outline" className="mt-1">{a.status}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
