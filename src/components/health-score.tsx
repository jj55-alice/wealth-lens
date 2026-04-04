'use client';

import type { AssetWithPrice, Liability } from '@/types/database';

interface HealthScoreProps {
  assets: AssetWithPrice[];
  liabilities: Liability[];
  totalAssets: number;
  totalLiabilities: number;
}

function calculateScore(props: HealthScoreProps): number {
  const { assets, totalAssets, totalLiabilities } = props;
  let score = 0;

  // 1. 자산 분산도 (HHI 기반, 0-35점)
  if (totalAssets > 0) {
    const categoryTotals = new Map<string, number>();
    for (const a of assets) {
      const cur = categoryTotals.get(a.category) ?? 0;
      categoryTotals.set(a.category, cur + a.current_value);
    }
    const shares = Array.from(categoryTotals.values()).map(
      (v) => v / totalAssets,
    );
    const hhi = shares.reduce((sum, s) => sum + s * s, 0);
    // HHI 1.0 = 완전 집중 (0점), HHI 0.2 = 5개 균등 (35점)
    score += Math.round(Math.max(0, (1 - hhi) / 0.8) * 35);
  }

  // 2. 비상금 비율 (현금 / 추정 월지출, 0-35점)
  const cashTotal = assets
    .filter((a) => a.category === 'cash')
    .reduce((sum, a) => sum + a.current_value, 0);
  // 추정 월지출 = 순자산의 0.5% (간이 추정, v2에서 사용자 입력으로 대체)
  const estimatedMonthly = Math.max(totalAssets * 0.005, 1);
  const emergencyMonths = cashTotal / estimatedMonthly;
  // 6개월 이상 = 만점
  score += Math.round(Math.min(emergencyMonths / 6, 1) * 35);

  // 3. 부채 비율 (부채/총자산, 0-30점)
  if (totalAssets > 0) {
    const debtRatio = totalLiabilities / totalAssets;
    // 0% = 만점, 60% 이상 = 0점
    score += Math.round(Math.max(0, 1 - debtRatio / 0.6) * 30);
  } else {
    score += totalLiabilities === 0 ? 30 : 0;
  }

  return Math.min(100, Math.max(0, score));
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

export function HealthScore(props: HealthScoreProps) {
  const score = calculateScore(props);
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-muted-foreground">재무 건강</div>
      <div className={`text-xs font-medium ${color}`}>{label}</div>
    </div>
  );
}
