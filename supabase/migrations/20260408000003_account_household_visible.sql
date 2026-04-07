-- 계좌 관리 모델 재설계
-- v0.1.3.2에서 user_id로 분리했지만, 가구 owner가 배우자 계좌를 미리 등록해줄 수
-- 없는 문제 발생. 가구 안에서는 모든 멤버의 계좌가 서로 보이고 관리할 수 있도록
-- 변경. 표시 시 user_id로 필터링은 UI/API 레이어가 담당.

-- 1. SELECT: 같은 가구 멤버는 모두 조회 가능
drop policy if exists "Users can view own accounts" on household_accounts;

create policy "Household members can view all accounts"
  on household_accounts for select
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));

-- 2. INSERT: 같은 가구 멤버라면 누구의 계좌든 추가 가능 (단, user_id는 같은 가구 멤버여야)
drop policy if exists "Users can insert own accounts" on household_accounts;

create policy "Household members can insert accounts for any member"
  on household_accounts for insert
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
    and user_id in (
      select user_id from household_members where household_id = household_accounts.household_id
    )
  );

-- 3. DELETE: 같은 가구 멤버라면 가구 내 어떤 계좌든 삭제 가능
drop policy if exists "Users can delete own accounts" on household_accounts;

create policy "Household members can delete accounts in their household"
  on household_accounts for delete
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()
  ));
