import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneOff, CalendarCheck, XCircle, TrendingUp, Clock } from 'lucide-react';
import { clientApi } from '@/lib/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AnalyticsPage() {
  const analyticsQ = useQuery({ queryKey: ['analytics'], queryFn: clientApi.getAnalytics });
  const trendsQ = useQuery({ queryKey: ['client-trends'], queryFn: clientApi.getTrends });

  if (analyticsQ.isLoading) return <Skeleton className="h-96" />;

  const a = analyticsQ.data;
  const perfData = [
    { name: 'Answered', value: a?.callsAnswered ?? 0 },
    { name: 'Missed', value: a?.callsMissed ?? 0 },
    { name: 'Bookings', value: a?.bookings ?? 0 },
    { name: 'Cancellations', value: a?.cancellations ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Analytics</h1>
        <p className="text-muted-foreground">Your AI receptionist performance this month</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Calls Answered" value={a?.callsAnswered ?? 0} icon={Phone} />
        <StatCard title="Calls Missed" value={a?.callsMissed ?? 0} icon={PhoneOff} />
        <StatCard title="Bookings" value={a?.bookings ?? 0} icon={CalendarCheck} />
        <StatCard title="Cancellations" value={a?.cancellations ?? 0} icon={XCircle} />
        <StatCard title="Conversion Rate" value={`${a?.conversionRate ?? 0}%`} icon={TrendingUp} />
        <StatCard
          title="Avg Call Duration"
          value={`${Math.floor((a?.avgCallDurationSec ?? 0) / 60)}m ${(a?.avgCallDurationSec ?? 0) % 60}s`}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Performance Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 16%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(224 47% 8%)', border: '1px solid hsl(215 28% 16%)', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        {!trendsQ.isLoading && (
          <TrendChart title="Call Volume (30 days)" data={trendsQ.data ?? []} dataKey="calls" color="#60a5fa" />
        )}
      </div>
    </div>
  );
}
