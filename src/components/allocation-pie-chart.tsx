'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatKRW } from '@/lib/format';
import type { AssetWithPrice } from '@/types/database';

const CLASS_LABELS: Record<string, string> = {
  domestic_equity: '국내주식',
  foreign_equity: '해외주식',
  bond: '채권',
  commodity: '원자재',
  cash_equiv: '현금성',
  alternative: '대안투자',
};

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#6b7280', // gray
];

interface Props {
  assets: AssetWithPrice[];
}

export function AllocationPieChart({ assets }: Props) {
  const classTotals = new Map<string, number>();
  for (const a of assets) {
    const cls = a.asset_class ?? 'alternative';
    const cur = classTotals.get(cls) ?? 0;
    classTotals.set(cls, cur + a.current_value);
  }

  const data = Array.from(classTotals.entries())
    .map(([key, value]) => ({
      name: CLASS_LABELS[key] ?? key,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatKRW(Number(value))}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--card-foreground))',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
