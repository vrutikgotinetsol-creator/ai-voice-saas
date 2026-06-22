import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatCurrency, formatDateTime, trialDaysLeft } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

function getSubscription(client: { subscriptions?: unknown }) {
  const subs = client.subscriptions;
  if (!subs) return null;
  return Array.isArray(subs) ? subs[0] : (subs as { status: string; amount_cents: number; plans?: { name: string } });
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['admin-client', id],
    queryFn: () => adminApi.getClient(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminApi.updateClientStatus(id!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-client', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteClient(id!),
    onSuccess: () => navigate('/clients'),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!client) return <p>Client not found</p>;

  const sub = getSubscription(client);
  const trial = client.status === 'trial' ? trialDaysLeft(client.trial_started_at) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <Badge variant={statusBadgeVariant(client.status)}>{client.status}</Badge>
          </div>
          <p className="text-muted-foreground">{client.business_type ?? 'Business'}</p>
        </div>
        <div className="flex gap-2">
          {client.status === 'suspended' ? (
            <Button variant="outline" onClick={() => statusMutation.mutate('active')}>
              <Play className="h-4 w-4" /> Activate
            </Button>
          ) : (
            <Button variant="outline" onClick={() => statusMutation.mutate('suspended')}>
              <Pause className="h-4 w-4" /> Suspend
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm('Delete this client permanently?')) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client.appointment_stats?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {client.appointment_stats?.confirmed ?? 0} confirmed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client.callLogs?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client.leads?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client.customers?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span>{client.owner_name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{client.owner_email ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{client.owner_phone ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(client.created_at)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span>{sub?.plans?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span>{sub?.status ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span>{sub ? formatCurrency(sub.amount_cents) : '—'}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trial days left</span>
              <span>{trial !== null ? `${trial} days` : '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(client.appointments ?? []).slice(0, 10).map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{appt.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{appt.customer_phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>{appt.service_name ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(appt.start_time)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{appt.status}</Badge>
                  </TableCell>
                  <TableCell>{appt.price_label ?? '—'}</TableCell>
                </TableRow>
              ))}
              {(client.appointments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No appointments yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(client.callLogs ?? []).slice(0, 10).map((call) => (
                <TableRow key={call.id}>
                  <TableCell>{formatDateTime(call.created_at)}</TableCell>
                  <TableCell>{call.duration_sec ? `${call.duration_sec}s` : '—'}</TableCell>
                  <TableCell>{call.outcome ?? '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">{call.summary ?? '—'}</TableCell>
                </TableRow>
              ))}
              {(client.callLogs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No calls yet
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
