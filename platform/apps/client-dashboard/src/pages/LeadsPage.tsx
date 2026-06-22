import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const STATUSES = ['new', 'contacted', 'won', 'lost'] as const;

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filter],
    queryFn: () => clientApi.getLeads(filter === 'all' ? undefined : filter),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      clientApi.updateLead(id, { status: status as 'new' | 'contacted' | 'won' | 'lost' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Callers who didn't book — follow up here</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leads</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Follow Up</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name ?? '—'}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{lead.call_reason ?? '—'}</TableCell>
                  <TableCell>{lead.follow_up_required ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <Select value={lead.status} onValueChange={(v) => mutation.mutate({ id: lead.id, status: v })}>
                      <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{formatDateTime(lead.created_at)}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-24">No leads captured yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
