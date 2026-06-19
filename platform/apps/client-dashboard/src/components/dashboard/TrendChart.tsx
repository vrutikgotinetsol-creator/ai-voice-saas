import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrendPoint } from '@/lib/api';

export function TrendChart({
  title,
  data,
  dataKey,
  color,
  valueFormatter,
}: {
  title: string;
  data: TrendPoint[];
  dataKey: keyof Pick<TrendPoint, 'appointments' | 'calls' | 'revenue'>;
  color: string;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 16%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'hsl(224 47% 8%)', border: '1px solid hsl(215 28% 16%)', borderRadius: 8 }}
                formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v, title]}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#g-${dataKey})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
