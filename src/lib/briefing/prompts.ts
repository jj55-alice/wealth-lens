import type { HoldingContext } from './types';
import type { NewsItem } from '../news/types';
import type { PaceSummary } from './pace';

function fmtKrw(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  const abs = Math.abs(Math.round(n));
  return `${sign}₩${abs.toLocaleString('ko-KR')}`;
}

/**
 * System prompt — 액션 단어 금지 + JSON 출력 강제 + 한국어 + disclaimer 강제.
 *
 * CEO 리뷰 결정: 카드 카피에 "매수", "매도", "추가", "정리" 같은 액션 단어 금지.
 * 정보 단어만 허용: "주목", "관망", "재확인", "확인 필요", "변동 주시".
 */
export const SYSTEM_PROMPT = `당신은 한국 사용자의 개인 주식 포트폴리오 브리핑을 작성하는 분석가입니다.

**역할**
사용자의 보유 종목과 최근 24시간 뉴스를 받아서, 사용자에게 **오늘 챙겨봐야 할 종목 카드**를 만듭니다. 일반 증권 앱과 달리 사용자의 매수가, 비중, 수익률 컨텍스트를 활용해서 개인화합니다.

**철저히 지킬 규칙**
1. **투자 권유 금지**: "매수", "매도", "추가", "정리", "팔아라", "사라" 같은 액션 단어를 절대 사용하지 마세요. 정보 단어만 사용: "주목", "관망", "재확인", "확인 필요", "변동 주시", "참고".
2. **컨텍스트 기반 개인화**: 매수가 대비 손실 종목 + 부정 뉴스 → 'risk'. 비중이 큰 종목 + 긍정 뉴스 → 'opportunity'. 그 외 중요한 변동은 'neutral'.
3. **노이즈 필터**: 모든 종목에 대해 카드를 만들지 말고, **진짜 챙겨봐야 할 3~5개**만 선별. 뉴스가 generic하면 카드 만들지 마세요.
4. **한국어**: 모든 출력은 한국어. 영어 뉴스도 한국어로 요약.
5. **간결**: headline은 1줄(40자 이내), context는 1줄(50자 이내).
6. **JSON만 출력**: 마크다운, 설명, 인사말 없이 JSON 객체만.

**출력 형식 (JSON)**
\`\`\`json
{
  "cards": [
    {
      "ticker": "NVDA",
      "name": "엔비디아",
      "signal": "risk",
      "headline": "AI 칩 수출 규제 우려 보도",
      "context": "매수가 -15%, 비중 12% — 관망 권장",
      "news_urls": ["https://..."]
    }
  ]
}
\`\`\`

**signal 값**
- "risk": 보유 종목에 부정적 시그널 (손실 + 부정 뉴스, 주요 악재)
- "opportunity": 긍정 시그널 (호재, 추가 상승 요인)
- "neutral": 중요한 변동이지만 방향이 불명확

**중요**: 카드를 만들 가치 없는 종목은 출력에서 제외하세요. 카드 0개도 OK입니다.`;

/**
 * User prompt — 보유 종목 컨텍스트 + 종목별 뉴스 묶음.
 */
export function buildUserPrompt(
  holdings: HoldingContext[],
  newsByTicker: Map<string, NewsItem[]>,
  pace: PaceSummary | null = null,
): string {
  const lines: string[] = [];

  // Pace 컨텍스트 — LLM 이 "기여 vs 시장" 을 구분해서 카피를 쓰도록 힌트 제공
  if (pace && pace.totalDelta !== 0) {
    lines.push(`# 최근 1일 순자산 변동 (${pace.from} → ${pace.to})`);
    lines.push(`- 총 변동: ${fmtKrw(pace.totalDelta)}`);
    lines.push(`- 기여 (매수/매도 반영): ${fmtKrw(pace.contribution)}`);
    lines.push(`- 시장 변동 (가격 움직임): ${fmtKrw(pace.marketDrift)}`);
    if (pace.unknownDelta !== 0) {
      lines.push(`- 미분해: ${fmtKrw(pace.unknownDelta)}`);
    }
    // 자산별 상위 3개 (|delta| 기준)
    const ranked = [...pace.byAsset]
      .filter((a) => a.reason === 'decomposed')
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
    if (ranked.length > 0) {
      lines.push(`- 주요 움직임:`);
      for (const a of ranked) {
        const mkt = a.marketDrift ?? 0;
        const contrib = a.contribution ?? 0;
        lines.push(`  - ${a.ticker ?? a.asset_id}: ${fmtKrw(a.delta)} (시장 ${fmtKrw(mkt)} · 기여 ${fmtKrw(contrib)})`);
      }
    }
    lines.push(
      `\n**카피 가이드**: 위 "기여" 금액은 사용자의 매수/매도 때문이고, "시장 변동"은 가격 움직임 때문입니다. 이를 혼동해서 "시장이 올랐다" 같은 표현을 사용자 본인 매수 때문인 변동에 쓰지 마세요.\n`,
    );
  }

  lines.push('# 사용자 포트폴리오\n');

  for (const h of holdings) {
    const returnStr = h.return_pct !== null ? `${h.return_pct >= 0 ? '+' : ''}${h.return_pct.toFixed(1)}%` : '매수가 미입력';
    lines.push(`- **${h.name}** (${h.ticker})`);
    lines.push(`  - 비중: ${h.weight_pct.toFixed(1)}%, 수익률: ${returnStr}, 자산군: ${h.asset_class ?? '미분류'}`);
  }

  lines.push('\n# 최근 24시간 뉴스 (종목별)\n');

  let totalNews = 0;
  for (const h of holdings) {
    const news = newsByTicker.get(h.ticker) ?? [];
    if (news.length === 0) continue;
    lines.push(`## ${h.name} (${h.ticker})`);
    for (const n of news) {
      lines.push(`- [${n.source}] ${n.title}`);
      if (n.summary) lines.push(`  ${n.summary.slice(0, 150)}`);
      if (n.url) lines.push(`  URL: ${n.url}`);
      totalNews++;
    }
    lines.push('');
  }

  if (totalNews === 0) {
    lines.push('(이번 24시간 동안 보유 종목 관련 뉴스가 없습니다.)');
  }

  lines.push('\n위 정보를 바탕으로, **오늘 사용자가 챙겨봐야 할 종목 카드** 를 JSON으로 출력하세요. 카드는 최대 5개. 가치 없는 종목은 제외.');

  return lines.join('\n');
}
