import { useQuery } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const OUTCOME_LABELS: Record<string, string> = {
  appointment_booked: 'Booked',
  faq_answered: 'FAQ',
  lead_captured: 'Lead',
  appointment_cancelled: 'Cancelled',
  no_action: 'No Action',
};

export function CallsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['calls'], queryFn: clientApi.getCalls });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calls</h1>
        <p className="text-muted-foreground">AI receptionist call history</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((call) => (
                <TableRow key={call.id}>
                  <TableCell>{formatDateTime(call.created_at)}</TableCell>
                  <TableCell>{call.customer_phone ?? '—'}</TableCell>
                  <TableCell>{call.duration_sec ? `${call.duration_sec}s` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {call.outcome ? OUTCOME_LABELS[call.outcome] ?? call.outcome : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>{call.sentiment ?? '—'}</TableCell>
                  <TableCell className="max-w-sm truncate">{call.summary ?? '—'}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-24">No calls yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
