-- 보유 종목 AI 브리핑 (Phase 4)
-- 매일 06:00 cron이 가구별로 카드 1행 생성. 측정 인프라 (cost/token/status) 포함.
-- CEO 리뷰 결정: 모달 (briefing_analyses)은 1주 dogfood 후 결정 → 차후 마이그레이션.

create table briefing_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  generated_at timestamptz not null default now(),
  date date not null default current_date,
  -- cards: [{ticker, name, signal: 'risk'|'opportunity'|'neutral', headline, context, news_urls, feedback?: 1|-1|null}]
  cards jsonb not null,
  model text not null,
  status text not null default 'success' check (status in ('success', 'partial', 'failed', 'empty')),
  -- 측정 인프라
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  error_message text,
  unique (household_id, date)
);

create index idx_briefing_cards_household_date on briefing_cards(household_id, date desc);

-- RLS: household members only
alter table briefing_cards enable row level security;

create policy "Household members can view briefing cards"
  on briefing_cards for select
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Household members can update briefing feedback"
  on briefing_cards for update
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

-- INSERT는 service role (cron)만 사용. anon에게 정책 없음.
