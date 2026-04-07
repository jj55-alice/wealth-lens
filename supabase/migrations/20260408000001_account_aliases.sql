-- 사용자 정의 주식 계좌 별칭
-- 사용자가 settings에서 미리 등록해두고, 자산 등록 시 퀵픽으로 사용

create table household_accounts (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references households(id) on delete cascade,
  brokerage text not null check (char_length(brokerage) <= 50),
  alias text not null check (char_length(alias) <= 50),
  created_at timestamptz not null default now(),
  unique(household_id, brokerage, alias)
);

create index idx_household_accounts_household on household_accounts(household_id);

-- assets 테이블에 계좌 별칭 컬럼 추가 (등록 시 직접 저장; household_accounts와 직접 FK는 안 검)
alter table assets add column if not exists account_alias text check (char_length(account_alias) <= 50);

-- RLS: household members only
alter table household_accounts enable row level security;

create policy "Users can view own household accounts"
  on household_accounts for select
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Users can insert own household accounts"
  on household_accounts for insert
  with check (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Users can delete own household accounts"
  on household_accounts for delete
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));
