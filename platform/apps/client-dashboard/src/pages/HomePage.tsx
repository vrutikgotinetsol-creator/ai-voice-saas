import { useQuery } from '@tanstack/react-query';
import { Calendar, Phone, DollarSign, Clock, TrendingUp, Users } from 'lucide-react';
import { clientApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/StatCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function HomePage() {
  const statsQ = useQuery({ queryKey: ['client-stats'], queryFn: clientApi.getStats });
  const trendsQ = useQuery({ queryKey: ['client-trends'], queryFn: clientApi.getTrends });

  if (statsQ.isLoading) return (
    <div className="space-y-8 animate-pulse">
      <Skeleton className="h-20 w-[400px]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );

  const stats = statsQ.data;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-primary via-accent to-blue-500 bg-clip-text text-transparent drop-shadow-sm pb-1">
          Overview
        </h1>
        <p className="text-muted-foreground text-lg font-medium">
          Here's what's happening with your AI Receptionist today.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        <StatCard 
          title="Appointments Today" 
          value={stats?.appointmentsToday ?? 0} 
          icon={Calendar} 
          className="bg-gradient-to-br from-white/60 to-primary/5 shadow-lg shadow-primary/5 border border-white/40 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300"
        />
        <StatCard 
          title="Calls Today" 
          value={stats?.callsToday ?? 0} 
          icon={Phone} 
          className="bg-gradient-to-br from-white/60 to-blue-500/5 shadow-lg shadow-blue-500/5 border border-white/40 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300"
        />
        <StatCard 
          title="Revenue Today" 
          value={formatCurrency(stats?.revenueTodayCents ?? 0)} 
          icon={DollarSign} 
          className="bg-gradient-to-br from-white/60 to-emerald-500/5 shadow-lg shadow-emerald-500/5 border border-white/40 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300"
        />
        <StatCard 
          title="This Month" 
          value={stats?.appointmentsThisMonth ?? 0} 
          subtitle="Total Appointments" 
          icon={TrendingUp} 
          className="bg-gradient-to-br from-white/60 to-accent/5 shadow-lg shadow-accent/5 border border-white/40 backdrop-blur-xl hover:-translate-y-1 transition-transform duration-300"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300 fill-mode-both">
        {trendsQ.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[350px] rounded-3xl" />)
        ) : (
          <>
            <div className="lg:col-span-1 rounded-3xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-xl shadow-black/5 p-2 transition-all hover:shadow-2xl">
              <TrendChart title="Appointments" data={trendsQ.data ?? []} dataKey="appointments" color="hsl(var(--primary))" />
            </div>
            <div className="lg:col-span-1 rounded-3xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-xl shadow-black/5 p-2 transition-all hover:shadow-2xl">
              <TrendChart title="Calls" data={trendsQ.data ?? []} dataKey="calls" color="#3b82f6" />
            </div>
            <div className="lg:col-span-1 rounded-3xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-xl shadow-black/5 p-2 transition-all hover:shadow-2xl">
              <TrendChart title="Revenue" data={trendsQ.data ?? []} dataKey="revenue" color="#10b981" valueFormatter={(v) => `$${v.toFixed(0)}`} />
            </div>
          </>
        )}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-16 duration-700 delay-500 fill-mode-both">
        <Card className="border-white/60 shadow-xl shadow-black/5 bg-white/50 backdrop-blur-2xl overflow-hidden rounded-3xl transition-all hover:shadow-2xl">
          <CardHeader className="border-b border-border/20 bg-white/40 pb-5">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              Upcoming Appointments
            </CardTitle>
            <CardDescription className="text-base ml-14">Your schedule for the next 7 days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(stats?.upcomingAppointments ?? []).length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground bg-white/20">
                <Calendar className="w-16 h-16 mb-5 text-primary/20" />
                <p className="text-lg font-medium">No upcoming appointments found.</p>
                <p className="text-sm mt-1">Your calendar is clear for the next week.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20 bg-white/20">
                {stats?.upcomingAppointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-5 hover:bg-white/60 transition-all cursor-default">
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
                        {a.customer_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">{a.customer_name}</p>
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Users className="w-3.5 h-3.5" /> {a.service_name ?? 'Appointment'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-foreground/90">{formatDateTime(a.start_time)}</p>
                      <Badge variant="secondary" className="mt-2 bg-white shadow-sm border-border/30 px-3 py-0.5 text-xs font-semibold text-primary">
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
