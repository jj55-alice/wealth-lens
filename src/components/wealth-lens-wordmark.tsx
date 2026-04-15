// 타이틀 로고. 아이콘과 동일한 에메랄드 스트로크 W + "ealth Lens" 타이포.
// 부모의 font-size를 상속받아 em 단위로 스케일.

import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /** SVG W 색상. 기본: emerald-500 */
  accent?: string;
}

export function WealthLensWordmark({ className, accent = '#10b981' }: Props) {
  return (
    <span className={cn('inline-flex items-baseline', className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="shrink-0"
        style={{
          width: '0.95em',
          height: '0.95em',
          // 베이스라인보다 살짝 아래로 내려서 다음 글자와 정렬
          transform: 'translateY(0.12em)',
        }}
      >
        <path
          d="M3 6 L7 18 L12 10 L17 18 L21 6"
          stroke={accent}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span>ealth Lens</span>
      <span className="sr-only">Wealth Lens</span>
    </span>
  );
}
