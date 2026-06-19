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

interface TrendChartProps {
  title: string;
  data: TrendPoint[];
  dataKey: keyof Pick<TrendPoint, 'appointments' | 'calls' | 'revenue'>;
  color: string;
  valueFormatter?: (v: number) => string;
}

export function TrendChart({ title, data, dataKey, color, valueFormatter }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 16%)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(224 47% 8%)',
                  border: '1px solid hsl(215 28% 16%)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(213 31% 91%)' }}
                formatter={(value: number) => [
                  valueFormatter ? valueFormatter(value) : value,
                  title,
                ]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={`url(#grad-${dataKey})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
