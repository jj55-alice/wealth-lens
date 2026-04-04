'use client';

import { formatKRW } from '@/lib/format';

const MILESTONES = [
  1_0000_0000, // 1억
  3_0000_0000, // 3억
  5_0000_0000, // 5억
  10_0000_0000, // 10억
  20_0000_0000, // 20억
  50_0000_0000, // 50억
];

interface Props {
  netWorth: number;
}

export function MilestoneCheck({ netWorth }: Props) {
  // Find the most recent milestone passed
  const passed = MILESTONES.filter((m) => netWorth >= m);
  const nextMilestone = MILESTONES.find((m) => netWorth < m);

  if (passed.length === 0 || !nextMilestone) return null;

  const lastMilestone = passed[passed.length - 1];
  const progress = ((netWorth - lastMilestone) / (nextMilestone - lastMilestone)) * 100;

  return (
    <div className="text-center space-y-2">
      <p className="text-xs text-muted-foreground">
        다음 목표: {formatKRW(nextMilestone)}
      </p>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formatKRW(nextMilestone - netWorth)} 남음
      </p>
    </div>
  );
}
