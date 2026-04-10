'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { BriefingCard, Signal } from '@/lib/briefing/types';
import type { PaceSummary } from '@/lib/briefing/pace';

interface Briefing {
  id: string;
  date: string;
  generated_at: string;
  cards: BriefingCard[];
  status: 'success' | 'partial' | 'failed' | 'empty';
  model: string;
  cost_usd: number | null;
  error_message: string | null;
  pace: PaceSummary | null;
  stale: boolean;
}

function formatKrwSigned(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  const abs = Math.abs(Math.round(n));
  return `${sign}₩${abs.toLocaleString('ko-KR')}`;
}

const SIGNAL_STYLES: Record<Signal, { icon: string; color: string; label: string }> = {
  risk: {
    icon: '⚠',
    color: 'text-amber-500',
    label: '주의',
  },
  opportunity: {
    icon: '✓',
    color: 'text-emerald-500',
    label: '기회',
  },
  neutral: {
    icon: '•',
    color: 'text-muted-foreground',
    label: '참고',
  },
};

export function BriefingCards() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch('/api/briefing/generate', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRetryError(data.error || `생성 실패 (${res.status})`);
      } else {
        await load();
      }
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : '네트워크 오류');
    } finally {
      setRetrying(false);
    }
  }

  async function load() {
    try {
      const res = await fetch('/api/briefing/today', { cache: 'no-store' });
      const data = await res.json();
      setBriefing(data.briefing);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFeedback(cardIndex: number, value: 1 | -1) {
    if (!briefing) return;
    const current = briefing.cards[cardIndex]?.feedback;
    const next = current === value ? null : value;

    // 낙관적 업데이트
    const newCards = [...briefing.cards];
    newCards[cardIndex] = { ...newCards[cardIndex], feedback: next };
    setBriefing({ ...briefing, cards: newCards });

    try {
      await fetch('/api/briefing/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing_id: briefing.id,
          card_index: cardIndex,
          feedback: next,
        }),
      });
    } catch {
      // 실패 시 원복
      load();
    }
  }

  if (loading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  // 브리핑이 아예 없거나 보유 종목이 없는 경우 → 표시 안 함
  if (!briefing || briefing.status === 'empty') {
    return null;
  }

  // 생성 실패 배너
  if (briefing.status === 'failed') {
    const isCreditError = briefing.error_message?.toLowerCase().includes('credit balance');
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-500 text-xs space-y-2">
        <div>
          ⚠ {briefing.date} 브리핑 생성 실패
          {briefing.error_message && (
            <span className="ml-1 text-muted-foreground">
              ({briefing.error_message.slice(0, 120)}
              {briefing.error_message.length > 120 ? '…' : ''})
            </span>
          )}
        </div>
        {isCreditError && (
          <div className="text-muted-foreground">
            💡 Anthropic 크레딧이 부족합니다. 설정 &gt; AI 브리핑 모델에서 OpenAI 로 전환하거나
            Anthropic 크레딧을 충전한 뒤 다시 시도하세요.
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="rounded border border-amber-500/40 px-2 py-1 text-[11px] hover:bg-amber-500/20 disabled:opacity-50"
          >
            {retrying ? '재시도 중...' : '🔄 다시 시도'}
          </button>
          {retryError && <span className="text-red-500 text-[11px]">{retryError}</span>}
        </div>
      </div>
    );
  }

  // 카드 0개 (LLM이 가치 없다고 판단) — pace 요약만 있으면 그거라도 노출
  if (briefing.cards.length === 0) {
    if (briefing.pace && briefing.pace.totalDelta !== 0) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">오늘의 브리핑</CardTitle>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {briefing.stale && <span className="text-amber-500">⚠ 어제 데이터</span>}
                <span>{formatTime(briefing.generated_at)} 갱신</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PaceSummaryBar pace={briefing.pace} />
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">오늘의 브리핑</CardTitle>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {briefing.stale && <span className="text-amber-500">⚠ 어제 데이터</span>}
            <span>{formatTime(briefing.generated_at)} 갱신</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {briefing.pace && briefing.pace.totalDelta !== 0 && (
          <PaceSummaryBar pace={briefing.pace} />
        )}
        {briefing.cards.map((card, idx) => {
          const style = SIGNAL_STYLES[card.signal] ?? SIGNAL_STYLES.neutral;
          return (
            <div
              key={`${card.ticker}-${idx}`}
              className="flex items-start justify-between rounded-lg border border-border px-3 py-2.5 gap-3"
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className={`${style.color} text-sm leading-5 mt-0.5`}>{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5">
                    <span className="text-muted-foreground mr-1.5">
                      {card.name || card.ticker}
                    </span>
                    {card.headline}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.context}</p>
                  {card.news_urls.length > 0 && (
                    <a
                      href={card.news_urls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-500 hover:underline mt-1 inline-block"
                    >
                      원본 뉴스 ↗
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleFeedback(idx, 1)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    card.feedback === 1
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  aria-label="도움됨"
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback(idx, -1)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    card.feedback === -1
                      ? 'bg-red-500/20 text-red-500'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  aria-label="도움 안 됨"
                >
                  👎
                </button>
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground pt-1">
          * 투자 권유가 아닙니다. 정보 정리 목적으로만 사용하세요.
        </p>
      </CardContent>
    </Card>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function PaceSummaryBar({ pace }: { pace: PaceSummary }) {
  const total = pace.totalDelta;
  const up = total >= 0;
  const totalColor = up ? 'text-emerald-500' : 'text-red-500';
  const explained = pace.contribution + pace.marketDrift;
  const denom = Math.abs(explained) || 1;
  const contribPct = Math.round((pace.contribution / denom) * 100);
  const mktPct = 100 - contribPct;
  // 기여/시장 중 어느 쪽이 주도했는지 한 문장 요약
  const dominantLabel = (() => {
    if (Math.abs(explained) < 1) return null;
    if (Math.abs(pace.contribution) > Math.abs(pace.marketDrift) * 1.5) {
      return pace.contribution >= 0 ? '주로 매수 기여' : '주로 매도 반영';
    }
    if (Math.abs(pace.marketDrift) > Math.abs(pace.contribution) * 1.5) {
      return pace.marketDrift >= 0 ? '주로 시장 상승' : '주로 시장 하락';
    }
    return '기여·시장 혼합';
  })();

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">
          {pace.from} → {pace.to}
        </span>
        <span className={`font-semibold ${totalColor}`}>{formatKrwSigned(total)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>기여 {formatKrwSigned(pace.contribution)}</span>
        <span>·</span>
        <span>시장 {formatKrwSigned(pace.marketDrift)}</span>
        {pace.unknownDelta !== 0 && (
          <>
            <span>·</span>
            <span>미분해 {formatKrwSigned(pace.unknownDelta)}</span>
          </>
        )}
        {dominantLabel && (
          <span className="ml-auto text-foreground/70">{dominantLabel}</span>
        )}
      </div>
      {Math.abs(explained) >= 1 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div className="flex h-full">
            <div
              className="bg-sky-500"
              style={{ width: `${Math.max(0, Math.min(100, contribPct))}%` }}
              title={`기여 ${contribPct}%`}
            />
            <div
              className="bg-amber-500"
              style={{ width: `${Math.max(0, Math.min(100, mktPct))}%` }}
              title={`시장 ${mktPct}%`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
