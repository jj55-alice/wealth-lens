-- 계좌를 사용자별로 분리: 같은 가구 안에서도 사용자별로 자기 계좌만 보임
-- 기존 household_accounts는 household 단위였음 → user 단위로 변경

-- 1. user_id 컬럼 추가 (NOT NULL은 데이터 마이그레이션 후 적용)
alter table household_accounts add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. 기존 row에 user_id 채우기 (가구의 첫 owner를 기본 owner로 — 없으면 첫 멤버)
update household_accounts ha
set user_id = (
  select hm.user_id
  from household_members hm
  where hm.household_id = ha.household_id
  order by case when hm.role = 'owner' then 0 else 1 end, hm.created_at
  limit 1
)
where user_id is null;

-- 3. user_id NOT NULL 강제
alter table household_accounts alter column user_id set not null;

-- 4. unique constraint 갱신: (household_id, brokerage, alias) → (user_id, brokerage, alias)
-- 같은 사용자가 같은 금융사+별칭을 중복 등록하는 것만 막음
alter table household_accounts drop constraint if exists household_accounts_household_id_brokerage_alias_key;
alter table household_accounts add constraint household_accounts_user_brokerage_alias_key
  unique (user_id, brokerage, alias);

-- 5. RLS 정책 갱신: user_id 기반으로 변경
drop policy if exists "Users can view own household accounts" on household_accounts;
drop policy if exists "Users can insert own household accounts" on household_accounts;
drop policy if exists "Users can delete own household accounts" on household_accounts;

create policy "Users can view own accounts"
  on household_accounts for select
  using (user_id = auth.uid());

create policy "Users can insert own accounts"
  on household_accounts for insert
  with check (user_id = auth.uid() and household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

create policy "Users can delete own accounts"
  on household_accounts for delete
  using (user_id = auth.uid());

-- 6. 인덱스 (사용자 lookup 최적화)
create index if not exists idx_household_accounts_user on household_accounts(user_id);
