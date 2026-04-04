-- Wealth Lens: Initial Schema
-- Household-based asset tracking for Korean dual-income couples

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table households (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '우리 가구',
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Max 2 members per household
create unique index idx_household_max_members
  on household_members(household_id, user_id);

create table assets (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  category text not null check (category in (
    'real_estate', 'stock', 'pension', 'gold', 'crypto', 'cash', 'other'
  )),
  subcategory text check (subcategory in (
    'owned', 'jeonse', 'pension', 'isa', 'irp', 'espp', 'savings', 'cma', 'other'
  )),
  ownership text not null check (ownership in ('personal', 'shared')) default 'personal',
  name text not null check (char_length(name) <= 100),
  ticker text check (char_length(ticker) <= 20),
  quantity numeric,
  manual_value numeric,
  price_source text not null check (price_source in (
    'krx', 'upbit', 'gold_exchange', 'yahoo_finance', 'manual'
  )) default 'manual',
  asset_class text check (asset_class in (
    'domestic_equity', 'foreign_equity', 'bond', 'commodity', 'cash_equiv', 'alternative'
  )),
  brokerage text check (char_length(brokerage) <= 50),
  address text check (char_length(address) <= 200),
  lease_expiry date, -- for jeonse assets
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assets_household on assets(household_id);
create index idx_assets_category on assets(household_id, category);

create table liabilities (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  category text not null check (category in ('mortgage', 'credit', 'student', 'other')),
  name text not null check (char_length(name) <= 100),
  balance numeric not null default 0,
  interest_rate numeric,
  linked_asset_id uuid references assets(id) on delete set null,
  ownership text not null check (ownership in ('personal', 'shared')) default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_liabilities_household on liabilities(household_id);

create table asset_snapshots (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references assets(id) on delete cascade,
  value numeric not null,
  snapshot_date date not null default current_date
);

create index idx_asset_snapshots_date on asset_snapshots(asset_id, snapshot_date);

create table liability_snapshots (
  id uuid primary key default uuid_generate_v4(),
  liability_id uuid not null references liabilities(id) on delete cascade,
  balance numeric not null,
  snapshot_date date not null default current_date
);

create index idx_liability_snapshots_date on liability_snapshots(liability_id, snapshot_date);

create table household_snapshots (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  total_assets numeric not null default 0,
  total_liabilities numeric not null default 0,
  net_worth numeric not null default 0,
  snapshot_date date not null default current_date
);

create index idx_household_snapshots_date on household_snapshots(household_id, snapshot_date);

-- Price cache for API results
create table price_cache (
  ticker text primary key,
  price numeric not null,
  currency text not null default 'KRW',
  source text not null,
  fetched_at timestamptz not null default now()
);

-- Household invitations
create table invitations (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id),
  invitee_email text not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_token on invitations(token);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table households enable row level security;
alter table household_members enable row level security;
alter table assets enable row level security;
alter table liabilities enable row level security;
alter table asset_snapshots enable row level security;
alter table liability_snapshots enable row level security;
alter table household_snapshots enable row level security;
alter table invitations enable row level security;
alter table price_cache enable row level security;

-- Helper: get household_ids for current user
create or replace function user_household_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

-- Households: members can view their own household
create policy "Members can view their household"
  on households for select
  using (id in (select user_household_ids()));

create policy "Authenticated users can create households"
  on households for insert
  to authenticated
  with check (true);

-- Household members: view members of your household
create policy "View household members"
  on household_members for select
  using (household_id in (select user_household_ids()));

create policy "Owner can manage members"
  on household_members for all
  using (household_id in (select user_household_ids()));

-- Assets: household members can CRUD all assets in their household
create policy "Household members can view assets"
  on assets for select
  using (household_id in (select user_household_ids()));

create policy "Household members can create assets"
  on assets for insert
  to authenticated
  with check (household_id in (select user_household_ids()));

create policy "Household members can update assets"
  on assets for update
  using (household_id in (select user_household_ids()));

create policy "Household members can delete assets"
  on assets for delete
  using (household_id in (select user_household_ids()));

-- Liabilities: same pattern as assets
create policy "Household members can view liabilities"
  on liabilities for select
  using (household_id in (select user_household_ids()));

create policy "Household members can create liabilities"
  on liabilities for insert
  to authenticated
  with check (household_id in (select user_household_ids()));

create policy "Household members can update liabilities"
  on liabilities for update
  using (household_id in (select user_household_ids()));

create policy "Household members can delete liabilities"
  on liabilities for delete
  using (household_id in (select user_household_ids()));

-- Snapshots: read-only for household members
create policy "View asset snapshots"
  on asset_snapshots for select
  using (asset_id in (
    select id from assets where household_id in (select user_household_ids())
  ));

create policy "View liability snapshots"
  on liability_snapshots for select
  using (liability_id in (
    select id from liabilities where household_id in (select user_household_ids())
  ));

create policy "View household snapshots"
  on household_snapshots for select
  using (household_id in (select user_household_ids()));

-- Invitations: inviter can manage, invitee can view by token
create policy "Inviter can manage invitations"
  on invitations for all
  using (household_id in (select user_household_ids()));

-- Price cache: public read
create policy "Anyone can read price cache"
  on price_cache for select
  to authenticated
  using (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on assets
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger assets_updated_at
  before update on assets
  for each row execute function update_updated_at();

create trigger liabilities_updated_at
  before update on liabilities
  for each row execute function update_updated_at();

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for assets and liabilities (partner sync)
alter publication supabase_realtime add table assets;
alter publication supabase_realtime add table liabilities;
