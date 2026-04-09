-- 가구별 브리핑 AI provider 선택 (anthropic | openai).
-- 기본값 anthropic 으로 backward compatible. CHECK 제약으로 오타 방지.
alter table households
  add column if not exists briefing_provider text not null default 'anthropic'
  check (briefing_provider in ('anthropic', 'openai'));
