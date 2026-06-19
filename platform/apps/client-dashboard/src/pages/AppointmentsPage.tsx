import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const STATUSES = ['confirmed', 'cancelled', 'completed', 'no_show'] as const;

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', status, date, search],
    queryFn: () =>
      clientApi.getAppointments({
        status: status === 'all' ? undefined : status,
        date: date || undefined,
        search: search || undefined,
      }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      clientApi.updateAppointment(id, { status: newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-muted-foreground">Manage bookings from your AI receptionist</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[180px]" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{a.customer_phone}</p>
                  </TableCell>
                  <TableCell>{a.service_name ?? '—'}</TableCell>
                  <TableCell>{a.price_label ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(a.start_time)}</TableCell>
                  <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={a.status}
                      onValueChange={(v) => mutation.mutate({ id: a.id, newStatus: v })}
                    >
                      <SelectTrigger className="w-[130px] h-8 ml-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-24">No appointments found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
