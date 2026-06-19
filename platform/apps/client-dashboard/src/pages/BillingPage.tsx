import { useQuery, useMutation } from '@tanstack/react-query';
import { CreditCard, ExternalLink } from 'lucide-react';
import { clientApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function BillingPage() {
  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: clientApi.getSubscription,
  });

  const portalMutation = useMutation({ mutationFn: clientApi.billingPortal });
  const checkoutMutation = useMutation({
    mutationFn: (planSlug: string) => clientApi.checkout(planSlug),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });

  if (isLoading) return <Skeleton className="h-96" />;

  const isTrialing = sub?.businessStatus === 'trial';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and payment method</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{sub?.plans?.name ?? 'No plan'} Plan</CardTitle>
              <CardDescription>
                {sub ? formatCurrency(sub.amount_cents) : '—'}/month
              </CardDescription>
            </div>
            <Badge variant={statusBadgeVariant(sub?.businessStatus ?? 'pending')}>
              {sub?.businessStatus ?? sub?.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTrialing && sub?.trialDaysLeft != null && (
            <p className="text-sm text-amber-400">
              {sub.trialDaysLeft} days left in your free trial
            </p>
          )}
          {sub?.current_period_end && (
            <p className="text-sm text-muted-foreground">
              Current period ends {formatDate(sub.current_period_end)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {sub?.status === 'active' || sub?.status === 'past_due' ? (
              <Button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                <CreditCard className="h-4 w-4" />
                Manage Billing
                <ExternalLink className="h-3 w-3" />
              </Button>
            ) : (
              <>
                <Button onClick={() => checkoutMutation.mutate('starter')} disabled={checkoutMutation.isPending}>
                  Subscribe — Starter
                </Button>
                <Button variant="outline" onClick={() => checkoutMutation.mutate('professional')} disabled={checkoutMutation.isPending}>
                  Subscribe — Professional
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
