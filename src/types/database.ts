// Database types for Wealth Lens
// Matches Supabase schema defined in supabase/migrations/

export type AssetCategory =
  | 'real_estate'
  | 'stock'
  | 'pension'
  | 'gold'
  | 'crypto'
  | 'cash'
  | 'other';

export type AssetSubcategory =
  | 'owned'
  | 'jeonse'
  | 'pension'
  | 'isa'
  | 'irp'
  | 'espp'
  | 'savings'
  | 'cma'
  | 'other';

export type PriceSource =
  | 'krx'
  | 'upbit'
  | 'gold_exchange'
  | 'yahoo_finance'
  | 'kb_real_estate'
  | 'manual';

export type AssetClass =
  | 'domestic_equity'
  | 'foreign_equity'
  | 'bond'
  | 'commodity'
  | 'cash_equiv'
  | 'alternative'
  | 'crypto'
  | 'real_estate';

export type LiabilityCategory =
  | 'mortgage'
  | 'credit'
  | 'student'
  | 'deposit'
  | 'other';

export type Ownership = 'personal' | 'shared';

export type HouseholdRole = 'owner' | 'member';

export type BriefingProvider = 'anthropic' | 'openai';

export interface Household {
  id: string;
  name: string;
  goal_net_worth: number | null;
  goal_annual_dividend: number | null;
  briefing_provider: BriefingProvider;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  created_at: string;
}

export interface Asset {
  id: string;
  household_id: string;
  owner_user_id: string;
  category: AssetCategory;
  subcategory: AssetSubcategory | null;
  ownership: Ownership;
  name: string;
  ticker: string | null;
  quantity: number | null;
  manual_value: number | null;
  price_source: PriceSource;
  asset_class: AssetClass | null;
  brokerage: string | null;
  account_alias: string | null; // 사용자 정의 계좌 별칭 (예: 메인, ISA)
  address: string | null;
  purchase_price: number | null; // cost basis per unit
  kb_complex_id: string | null; // KB real estate complex ID
  kb_estimated_value: number | null; // KB auto-fetched estimated price
  kb_estimated_at: string | null; // Last KB price fetch timestamp
  lease_expiry: string | null; // ISO date, for jeonse
  created_at: string;
  updated_at: string;
}

export interface Liability {
  id: string;
  household_id: string;
  owner_user_id: string;
  category: LiabilityCategory;
  name: string;
  balance: number;
  interest_rate: number | null;
  linked_asset_id: string | null;
  ownership: Ownership;
  created_at: string;
  updated_at: string;
}

export interface AssetSnapshot {
  id: string;
  asset_id: string;
  value: number;
  snapshot_date: string;
}

export interface LiabilitySnapshot {
  id: string;
  liability_id: string;
  balance: number;
  snapshot_date: string;
}

export interface HouseholdSnapshot {
  id: string;
  household_id: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  snapshot_date: string;
}

export interface DividendCache {
  ticker: string;
  dividend_per_share: number;
  ex_date: string;
  payment_date: string | null;
  frequency: 'quarterly' | 'semi_annual' | 'annual' | null;
  fetched_at: string;
}

// Computed types for the dashboard
export interface AssetWithPrice extends Asset {
  current_price: number | null;
  current_value: number;
  price_updated_at: string | null;
  is_stale: boolean;
  /** 어제 종가. 당일 변동률 계산용. null이면 데이터 없음. */
  previous_close: number | null;
  /** 당일 변동률 (%). (current_price - previous_close) / previous_close * 100. null이면 계산 불가. */
  daily_change_rate: number | null;
}

export interface DashboardData {
  household: Household;
  assets: AssetWithPrice[];
  liabilities: Liability[];
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  net_worth_change_week: number | null;
  net_worth_change_month: number | null;
}
