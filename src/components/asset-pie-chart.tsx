'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatKRW } from '@/lib/format';
import type { AssetWithPrice } from '@/types/database';

const CATEGORY_LABELS: Record<string, string> = {
  real_estate: '부동산',
  stock: '주식',
  pension: '연금',
  gold: '금',
  crypto: '코인',
  cash: '현금',
  other: '기타',
};

const COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
];

interface Props {
  assets: AssetWithPrice[];
}

export function AssetPieChart({ assets }: Props) {
  const categoryTotals = new Map<string, number>();
  for (const a of assets) {
    const cur = categoryTotals.get(a.category) ?? 0;
    categoryTotals.set(a.category, cur + a.current_value);
  }

  const data = Array.from(categoryTotals.entries())
    .map(([key, value]) => ({
      name: CATEGORY_LABELS[key] ?? key,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
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
