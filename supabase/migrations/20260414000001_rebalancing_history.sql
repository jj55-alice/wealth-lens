-- 리밸런싱 확인 이력
create table if not exists rebalancing_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  status text not null check (status in ('balanced', 'needs_adjustment', 'urgent')),
  max_drift numeric(5,2) not null default 0,
  suggestions jsonb not null default '[]',
  total_liquid numeric not null default 0,
  checked_at timestamptz not null default now()
);

create index idx_rebalancing_history_household on rebalancing_history(household_id, checked_at desc);

alter table rebalancing_history enable row level security;

create policy "Users can read own household history"
  on rebalancing_history for select
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));
