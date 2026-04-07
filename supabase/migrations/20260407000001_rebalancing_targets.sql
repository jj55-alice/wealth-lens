-- Rebalancing target allocation per household
create table rebalancing_targets (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references households(id) on delete cascade,
  asset_class text not null check (asset_class in (
    'domestic_equity', 'foreign_equity', 'bond', 'commodity',
    'crypto', 'cash_equiv'
  )),
  target_ratio numeric(5,2) not null check (target_ratio >= 0 and target_ratio <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id, asset_class)
);

create index idx_rebalancing_targets_household on rebalancing_targets(household_id);

-- RLS: household members only
alter table rebalancing_targets enable row level security;

create policy "Users can view own household targets"
  on rebalancing_targets for select
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Users can insert own household targets"
  on rebalancing_targets for insert
  with check (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Users can update own household targets"
  on rebalancing_targets for update
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Users can delete own household targets"
  on rebalancing_targets for delete
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));
