import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { clientApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => clientApi.getCustomer(id!),
    enabled: !!id,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!customer) return <p>Customer not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/customers"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.phone} · {customer.email ?? 'No email'}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Visits</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{customer.total_appointments}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime Value</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(customer.lifetime_value_cents)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Notes</CardTitle></CardHeader><CardContent><p className="text-sm">{customer.notes ?? '—'}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Appointment History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(customer.appointments ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.service_name ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(a.start_time)}</TableCell>
                  <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                  <TableCell>{a.price_label ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
