import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Pause, Play, Trash2, KeyRound } from 'lucide-react';
import { adminApi, type ClientListItem } from '@/lib/api';
import { formatCurrency, trialDaysLeft } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [resetClient, setResetClient] = useState<ClientListItem | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: clients, isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: adminApi.getClients,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateClientStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-clients'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteClient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-clients'] }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminApi.resetPassword(id, password),
    onSuccess: () => {
      setResetClient(null);
      setNewPassword('');
    },
  });

  const filtered = (clients ?? []).filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.owner_email ?? '').toLowerCase().includes(q) ||
      (c.owner_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage all business accounts</p>
        </div>
        <Button onClick={() => navigate('/clients/new')}>
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      <Input
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Trial Left</TableHead>
                <TableHead>Appointments</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => {
                const subs = client.subscriptions;
                const sub = Array.isArray(subs) ? subs[0] : subs;
                const plan = sub?.plans?.name ?? '—';
                const trial = client.status === 'trial' ? trialDaysLeft(client.trial_started_at) : null;

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.business_type ?? '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{client.owner_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{client.owner_email ?? '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {client.locations?.[0]?.vapi_phone_number_display ?? client.owner_phone ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(client.status)}>{client.status}</Badge>
                    </TableCell>
                    <TableCell>{plan}</TableCell>
                    <TableCell>{trial !== null ? `${trial}d` : '—'}</TableCell>
                    <TableCell>{client.appointment_stats.total}</TableCell>
                    <TableCell>{sub ? formatCurrency(sub.amount_cents) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/clients/${client.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {client.status === 'suspended' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => statusMutation.mutate({ id: client.id, status: 'active' })}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => statusMutation.mutate({ id: client.id, status: 'suspended' })}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setResetClient(client)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Delete ${client.name}? This cannot be undone.`)) {
                              deleteMutation.mutate(client.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No clients found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!resetClient} onOpenChange={() => setResetClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {resetClient?.owner_email}</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button
            disabled={newPassword.length < 8 || resetMutation.isPending}
            onClick={() =>
              resetClient && resetMutation.mutate({ id: resetClient.id, password: newPassword })
            }
          >
            Reset Password
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
