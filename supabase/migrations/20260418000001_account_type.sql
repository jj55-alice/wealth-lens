-- household_accounts 에 계좌유형(account_type) 컬럼 추가.
-- 기존에는 assets.subcategory 에 주식 계좌유형(pension/isa/irp/espp/other) 이 저장되어 있었는데,
-- "같은 계좌 안의 종목은 같은 세제 혜택을 받는다"는 원칙에 맞춰 계좌 레벨로 이동.

-- 1. 컬럼 추가 (nullable 로 먼저 생성 → backfill → NOT NULL)
alter table household_accounts
  add column if not exists account_type text
  check (account_type in ('pension','isa','irp','espp','other'));

-- 2. Backfill: assets.subcategory 에서 계좌별 최신 값을 채택.
--    같은 (user_id, brokerage, alias) 조합에 여러 자산이 있을 때,
--    created_at 기준 최신 자산의 subcategory 가 우선.
update household_accounts ha
set account_type = sub.subcat
from (
  select distinct on (a.owner_user_id, a.brokerage, a.account_alias)
    a.owner_user_id,
    a.brokerage,
    a.account_alias,
    a.subcategory as subcat
  from assets a
  where a.category = 'stock'
    and a.subcategory in ('pension','isa','irp','espp','other')
    and a.brokerage is not null
    and a.account_alias is not null
  order by a.owner_user_id, a.brokerage, a.account_alias, a.created_at desc
) sub
where ha.user_id = sub.owner_user_id
  and ha.brokerage = sub.brokerage
  and ha.alias = sub.account_alias
  and ha.account_type is null;

-- 3. 나머지 (backfill 매칭 실패) → 'other' 기본값
update household_accounts
set account_type = 'other'
where account_type is null;

-- 4. NOT NULL + default 고정
alter table household_accounts
  alter column account_type set default 'other',
  alter column account_type set not null;
