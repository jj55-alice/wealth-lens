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
  /** 당일 변동률 (%). null이면 데이터 없음 (neutral 색). */
  dailyChangeRate: number | null;
  currentValue: number;
  ticker: string;
  [key: string]: string | number | null;
}

/**
 * 당일 변동률 기준 색상. 주식은 하루 ±5%가 꽤 큰 움직임이라
 * 기존 all-time 수익률(±20% 스케일)보다 스케일을 좁혔다.
 */
function getColor(rate: number | null): string {
  if (rate == null) return '#6b7280'; // gray-500: 데이터 없음
  if (rate > 5) return '#16a34a';
  if (rate > 2) return '#22c55e';
  if (rate > 0) return '#4ade80';
  if (rate === 0) return '#9ca3af'; // 변동 없음: neutral gray
  if (rate > -2) return '#f87171';
  if (rate > -5) return '#ef4444';
  return '#dc2626';
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

function CustomContent(props: Record<string, unknown>) {
  const { x, y, width, height, name, dailyChangeRate } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    dailyChangeRate: number | null | undefined;
  };

  if (width < 40 || height < 30) return null;

  const rate = dailyChangeRate ?? null;
  const color = getColor(rate);

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
        {formatRate(rate)}
      </text>
    </g>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TreemapNode }>;
}) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const rate = data.dailyChangeRate;
  const rateColor =
    rate == null
      ? 'text-muted-foreground'
      : rate >= 0
        ? 'text-emerald-500'
        : 'text-red-500';

  return (
    <div className="rounded-lg bg-card border border-border px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold">
        {data.name} ({data.ticker})
      </p>
      <p>평가액: {formatKRW(data.currentValue)}</p>
      <p className={rateColor}>당일: {formatRate(rate)}</p>
    </div>
  );
}

export function StockTreemap({ stocks }: Props) {
  const data: TreemapNode[] = stocks
    .filter((s) => s.current_value > 0)
    .map((s) => ({
      name: s.name,
      size: s.current_value,
      dailyChangeRate: s.daily_change_rate,
      currentValue: s.current_value,
      ticker: s.ticker ?? '',
    }));

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
        isAnimationActive={false}
        content={<CustomContent />}
      >
        <Tooltip content={<CustomTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
