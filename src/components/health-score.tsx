'use client';

import type { AssetWithPrice, Liability } from '@/types/database';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HealthScoreProps {
  assets: AssetWithPrice[];
  liabilities: Liability[];
  totalAssets: number;
  totalLiabilities: number;
}

interface ScoreBreakdown {
  total: number;
  diversification: number;
  emergency: number;
  debt: number;
  emergencyMonths: number;
  debtRatio: number;
  categoryCount: number;
}

function calculateScore(props: HealthScoreProps): ScoreBreakdown {
  const { assets, totalAssets, totalLiabilities } = props;
  let diversification = 0;
  let categoryCount = 0;

  // 1. 자산 분산도 (HHI 기반, 0-35점)
  if (totalAssets > 0) {
    const categoryTotals = new Map<string, number>();
    for (const a of assets) {
      const cur = categoryTotals.get(a.category) ?? 0;
      categoryTotals.set(a.category, cur + a.current_value);
    }
    categoryCount = categoryTotals.size;
    const shares = Array.from(categoryTotals.values()).map(
      (v) => v / totalAssets,
    );
    const hhi = shares.reduce((sum, s) => sum + s * s, 0);
    diversification = Math.round(Math.max(0, (1 - hhi) / 0.8) * 35);
  }

  // 2. 비상금 비율 (현금 / 추정 월지출, 0-35점)
  const cashTotal = assets
    .filter((a) => a.category === 'cash')
    .reduce((sum, a) => sum + a.current_value, 0);
  const estimatedMonthly = Math.max(totalAssets * 0.005, 1);
  const emergencyMonths = cashTotal / estimatedMonthly;
  const emergency = Math.round(Math.min(emergencyMonths / 6, 1) * 35);

  // 3. 부채 비율 (부채/총자산, 0-30점)
  let debtRatio = 0;
  let debt = 0;
  if (totalAssets > 0) {
    debtRatio = totalLiabilities / totalAssets;
    debt = Math.round(Math.max(0, 1 - debtRatio / 0.6) * 30);
  } else {
    debt = totalLiabilities === 0 ? 30 : 0;
  }

  const total = Math.min(100, Math.max(0, diversification + emergency + debt));

  return { total, diversification, emergency, debt, emergencyMonths, debtRatio, categoryCount };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '우수';
  if (score >= 60) return '양호';
  if (score >= 40) return '보통';
  return '주의';
}

function MetricBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-current transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function HealthScore(props: HealthScoreProps) {
  const breakdown = calculateScore(props);
  const color = getScoreColor(breakdown.total);
  const label = getScoreLabel(breakdown.total);

  return (
    <Tooltip>
      <TooltipTrigger
        className="text-center cursor-help outline-none"
      >
        <div className={`text-3xl font-bold ${color}`}>{breakdown.total}</div>
        <div className="text-xs text-muted-foreground">재무 건강</div>
        <div className={`text-xs font-medium ${color}`}>{label}</div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="end"
        className="w-64 p-3 space-y-2.5 text-left"
      >
        <div className="font-medium text-xs mb-2">점수 산정 기준</div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>자산 분산도</span>
            <span className="tabular-nums">{breakdown.diversification}/35</span>
          </div>
          <MetricBar score={breakdown.diversification} max={35} />
          <div className="text-xs opacity-70">
            {breakdown.categoryCount}개 자산군 · HHI 기반 (5개 균등 = 만점)
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>비상금 비율</span>
            <span className="tabular-nums">{breakdown.emergency}/35</span>
          </div>
          <MetricBar score={breakdown.emergency} max={35} />
          <div className="text-xs opacity-70">
            현금 {breakdown.emergencyMonths.toFixed(1)}개월분 · 6개월 이상 = 만점
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>부채 비율</span>
            <span className="tabular-nums">{breakdown.debt}/30</span>
          </div>
          <MetricBar score={breakdown.debt} max={30} />
          <div className="text-xs opacity-70">
            부채 {(breakdown.debtRatio * 100).toFixed(0)}% · 0% = 만점, 60%↑ = 0점
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
