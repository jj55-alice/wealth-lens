# Design System — Wealth Lens

## Product Context
- **What this is:** 한국 가구 자산 관리 대시보드. 부부가 함께 자산을 추적하고 리밸런싱하는 도구.
- **Who it's for:** 한국 부부/가구. 자산을 체계적으로 관리하고 싶은 개인 투자자.
- **Space/industry:** 개인 자산관리 (PFM), 한국 시장. 뱅크샐러드/토스 대비 가구 단위 차별화.
- **Project type:** Web app / Dashboard (데이터 밀도 높음, 기능 중심)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian
- **Decoration level:** Minimal — 타이포그래피와 데이터가 디자인을 이끔
- **Mood:** 신뢰할 수 있는 금융 도구. 차분하고, 정확하고, 군더더기 없음. "내 돈을 맡길 수 있는 느낌."
- **Reference sites:** Bloomberg Terminal (데이터 밀도), Ghostfolio (오픈소스 자산관리), M1 Finance (리밸런싱 UX)

## Typography
- **Display/Hero:** Geist Sans (Bold/Semibold) — 모던 산세리프, 높은 x-height로 가독성 우수
- **Body:** Geist Sans (Regular/Medium) — 동일 패밀리로 일관성 유지
- **UI/Labels:** Geist Sans (same as body)
- **Data/Tables:** Geist Sans (tabular-nums) — 금액/퍼센트 표시 시 `font-variant-numeric: tabular-nums` 필수
- **Code:** Geist Mono — 디버그 정보, 티커 코드 등
- **Loading:** `next/font/google` (Geist, Geist_Mono) — 이미 설정됨
- **Scale:**
  - text-xs: 12px (보조 정보, 배지, 날짜)
  - text-sm: 14px (본문, 리스트 항목)
  - text-base: 16px (주요 본문)
  - text-lg: 18px (카드 제목, 섹션 헤더)
  - text-xl: 20px (페이지 제목)
  - text-2xl: 24px (대시보드 핵심 수치)
  - text-4xl: 36px (히어로 금액)

## Color

### Approach: Restrained
색상은 의미를 전달할 때만 사용. 장식적 색상 없음.

### Semantic Colors (직접 사용)
- **수익/긍정:** `text-emerald-500` (#10b981) — 수익률, 증가, 성공
- **손실/부정:** `text-red-500` (#ef4444) — 손실, 감소, 에러
- **경고:** `text-amber-500` (#f59e0b) — stale 데이터, 주의, 경고 배너
- **정보:** `text-blue-500` (#3b82f6) — 링크, 정보성 배지

### Chart Colors (CSS 변수로 관리)
```css
--chart-1: #3b82f6; /* blue — 국내주식 */
--chart-2: #8b5cf6; /* violet — 해외주식 */
--chart-3: #06b6d4; /* cyan — 채권 */
--chart-4: #f59e0b; /* amber — 원자재/금 */
--chart-5: #10b981; /* emerald — 크립토 */
--chart-6: #6b7280; /* gray — 현금성 */
```

### Surface Colors (shadcn/ui CSS 변수)
- **Background:** `--background` (light: oklch(1 0 0), dark: oklch(0.145 0 0))
- **Card:** `--card` (light: oklch(1 0 0), dark: oklch(0.205 0 0))
- **Border:** `--border` (neutral 경계)
- **Muted:** `--muted` / `--muted-foreground` (보조 텍스트)
- **Primary:** `--primary` (버튼, 강조)

### Dark Mode Strategy
- next-themes로 토글. CSS 변수 자동 전환.
- 다크 모드에서 채도 10-20% 감소시키지 않음 (emerald/red는 다크에서도 동일 값 유지)
- 서페이스만 전환: background, card, border, muted

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:**
  - 2xs: 2px (미세 조정)
  - xs: 4px (인라인 갭)
  - sm: 8px (카드 내 요소 간격)
  - md: 16px (섹션 내 요소 간격)
  - lg: 24px (섹션 간 간격)
  - xl: 32px (페이지 padding)
  - 2xl: 48px (대형 섹션 간격)

## Layout
- **Approach:** Grid-disciplined
- **Container:** `max-w-5xl mx-auto` (1024px)
- **Page padding:** `px-6 py-8` (mobile: `px-4 py-6`)
- **Card padding:** `p-4` ~ `p-6`
- **Grid:** 모바일 1col, sm(640px) 2col, md(768px+) 유동적
- **Border radius:**
  - sm: `rounded-md` (4px) — 배지, 버튼
  - md: `rounded-lg` (8px) — 입력 필드, 작은 카드
  - lg: `rounded-xl` (12px) — 메인 카드
  - full: `rounded-full` — 프로필 이미지, 범례 점

## Motion
- **Approach:** Minimal-functional
- **사용 사례:**
  - 페이지 전환: 없음 (Next.js 기본)
  - 버튼 hover: `transition-colors` (150ms)
  - 로딩: Skeleton pulse 애니메이션
  - 토스트: slide-in + fade-out
- **금지:** 스크롤 애니메이션, 입장 애니메이션, 장식적 모션

## Component Patterns

### 금액 표시
```tsx
// 항상 tabular-nums 사용
<p className="text-2xl font-bold tabular-nums">{formatKRW(amount)}</p>
```

### 수익/손실 색상
```tsx
<p className={`${value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
  {value >= 0 ? '+' : ''}{formatPercent(value)}
</p>
```

### 카드 구조
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm">{title}</CardTitle>
  </CardHeader>
  <CardContent>{children}</CardContent>
</Card>
```

### Empty State
```tsx
// 따뜻한 안내 + 명확한 CTA. "데이터 없음"은 디자인이 아님.
<div className="text-center py-10">
  <p className="text-muted-foreground mb-2">{message}</p>
  <Button>{actionLabel}</Button>
</div>
```

### Stale 데이터 경고
```tsx
// amber 배경 + 경고 텍스트
<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-500 text-xs">
  ⚠ {warning}
</div>
```

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-06 | Initial design system created | 기존 코드 패턴 문서화. /design-consultation 기반. |
| 2026-04-06 | Chart colors → CSS 변수 | 하드코딩된 차트 색상을 CSS 변수로 통합하여 테마 일관성 확보 |
| 2026-04-06 | tabular-nums 강제 | 금액/퍼센트 표시에서 숫자 너비 일정하게 유지 (데이터 점프 방지) |
