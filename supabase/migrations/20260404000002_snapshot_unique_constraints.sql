-- Add unique constraints on snapshot tables to prevent duplicates on cron re-run
-- Also add CHECK constraints for non-negative values

-- Snapshot unique constraints
create unique index idx_asset_snapshots_unique
  on asset_snapshots(asset_id, snapshot_date);

create unique index idx_liability_snapshots_unique
  on liability_snapshots(liability_id, snapshot_date);

create unique index idx_household_snapshots_unique
  on household_snapshots(household_id, snapshot_date);

-- Data integrity: non-negative values
alter table assets add constraint assets_quantity_non_negative
  check (quantity is null or quantity >= 0);

alter table assets add constraint assets_manual_value_non_negative
  check (manual_value is null or manual_value >= 0);

alter table liabilities add constraint liabilities_balance_non_negative
  check (balance >= 0);

-- Remove redundant index (duplicate of primary key)
drop index if exists idx_household_max_members;

-- Fix RLS: split "Owner can manage members" into proper policies
drop policy if exists "Owner can manage members" on household_members;

create policy "Members can insert into their household"
  on household_members for insert
  to authenticated
  with check (
    household_id in (select user_household_ids())
    or not exists (select 1 from household_members where household_id = household_members.household_id)
  );

create policy "Owner can update members"
  on household_members for update
  using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "Owner can delete members"
  on household_members for delete
  using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and role = 'owner'
    )
  );
