'use client';

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { AssetWithPrice } from '@/types/database';
import { formatKRW } from '@/lib/format';

interface Props {
  stocks: AssetWithPrice[];
}

interface TreemapNode {
  name: string;
  size: number;
  returnRate: number;
  currentValue: number;
  ticker: string;
  [key: string]: string | number;
}

function getColor(returnRate: number): string {
  if (returnRate > 20) return '#16a34a';
  if (returnRate > 10) return '#22c55e';
  if (returnRate > 0) return '#4ade80';
  if (returnRate > -10) return '#f87171';
  if (returnRate > -20) return '#ef4444';
  return '#dc2626';
}

function CustomContent(props: Record<string, unknown>) {
  const { x, y, width, height, name, returnRate } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    returnRate: number;
  };

  if (width < 40 || height < 30 || returnRate === undefined) return null;

  const color = getColor(returnRate ?? 0);
  const sign = (returnRate ?? 0) >= 0 ? '+' : '';

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#1a1a2e"
        strokeWidth={2}
        rx={4}
        style={{ opacity: 0.9 }}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        fill="white"
        fontSize={width > 80 ? 13 : 11}
        fontWeight="bold"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        fill="white"
        fontSize={11}
        opacity={0.9}
      >
        {sign}{(returnRate ?? 0).toFixed(1)}%
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TreemapNode }> }) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const sign = data.returnRate >= 0 ? '+' : '';

  return (
    <div className="rounded-lg bg-card border border-border px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold">{data.name} ({data.ticker})</p>
      <p>평가액: {formatKRW(data.currentValue)}</p>
      <p className={data.returnRate >= 0 ? 'text-emerald-500' : 'text-red-500'}>
        수익률: {sign}{data.returnRate.toFixed(1)}%
      </p>
    </div>
  );
}

export function StockTreemap({ stocks }: Props) {
  const data: TreemapNode[] = stocks
    .filter((s) => s.current_value > 0)
    .map((s) => {
      const purchasePrice = s.purchase_price;
      const currentPrice = s.current_price ?? 0;
      const returnRate = purchasePrice && purchasePrice > 0
        ? ((currentPrice - purchasePrice) / purchasePrice) * 100
        : 0;

      return {
        name: s.name,
        size: s.current_value,
        returnRate,
        currentValue: s.current_value,
        ticker: s.ticker ?? '',
      };
    });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        주식 자산이 없습니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        content={<CustomContent />}
      >
        <Tooltip content={<CustomTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
