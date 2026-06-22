import { useQuery } from '@tanstack/react-query';
import { CreditCard, AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export function BillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-billing'],
    queryFn: adminApi.getBillingOverview,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Subscription health and revenue overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Subscriptions" value={data?.activeSubscriptions ?? 0} icon={CreditCard} />
        <StatCard title="Past Due" value={data?.pastDueSubscriptions ?? 0} icon={AlertTriangle} />
        <StatCard title="Trials" value={data?.trialSubscriptions ?? 0} icon={Clock} />
        <StatCard
          title="Monthly Recurring Revenue"
          value={`$${(data?.monthlyRecurringRevenue ?? 0).toLocaleString()}`}
          icon={CreditCard}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Churn Rate: {(data?.churnRate ?? 0).toFixed(1)}%
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.subscriptions ?? []).map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.businesses?.name ?? '—'}</TableCell>
                  <TableCell>{sub.plans?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(sub.status === 'canceled' ? 'cancelled' : sub.status)}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(sub.amount_cents)}/mo</TableCell>
                </TableRow>
              ))}
              {(data?.subscriptions ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No subscriptions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
