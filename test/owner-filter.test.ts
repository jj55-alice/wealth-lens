import { describe, it, expect } from 'vitest';
import type { AssetWithPrice, Liability } from '@/types/database';

type OwnerFilter = 'all' | 'mine' | 'spouse' | 'shared';

function filterAssets(assets: AssetWithPrice[], filter: OwnerFilter, currentUserId: string): AssetWithPrice[] {
  if (filter === 'all') return assets;
  if (filter === 'mine') return assets.filter(a => a.owner_user_id === currentUserId && a.ownership === 'personal');
  if (filter === 'spouse') return assets.filter(a => a.owner_user_id !== currentUserId && a.ownership === 'personal');
  if (filter === 'shared') return assets.filter(a => a.ownership === 'shared');
  return assets;
}

function filterLiabilities(liabilities: Liability[], filter: OwnerFilter, currentUserId: string): Liability[] {
  if (filter === 'all') return liabilities;
  if (filter === 'mine') return liabilities.filter(l => l.owner_user_id === currentUserId && l.ownership === 'personal');
  if (filter === 'spouse') return liabilities.filter(l => l.owner_user_id !== currentUserId && l.ownership === 'personal');
  if (filter === 'shared') return liabilities.filter(l => l.ownership === 'shared');
  return liabilities;
}

const ME = 'user-1';
const SPOUSE = 'user-2';

const mockAssets = [
  { id: '1', owner_user_id: ME, ownership: 'personal', current_value: 1000, name: '내 주식' },
  { id: '2', owner_user_id: SPOUSE, ownership: 'personal', current_value: 2000, name: '배우자 주식' },
  { id: '3', owner_user_id: ME, ownership: 'shared', current_value: 5000, name: '공동 부동산' },
] as unknown as AssetWithPrice[];

const mockLiabilities = [
  { id: 'l1', owner_user_id: ME, ownership: 'personal', balance: 100 },
  { id: 'l2', owner_user_id: SPOUSE, ownership: 'personal', balance: 200 },
  { id: 'l3', owner_user_id: ME, ownership: 'shared', balance: 500 },
] as unknown as Liability[];

describe('Owner Filter', () => {
  it('all: returns everything', () => {
    expect(filterAssets(mockAssets, 'all', ME)).toHaveLength(3);
    expect(filterLiabilities(mockLiabilities, 'all', ME)).toHaveLength(3);
  });

  it('mine: returns only my personal assets', () => {
    const result = filterAssets(mockAssets, 'mine', ME);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('내 주식');
  });

  it('spouse: returns only spouse personal assets', () => {
    const result = filterAssets(mockAssets, 'spouse', ME);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('배우자 주식');
  });

  it('shared: returns only shared assets', () => {
    const result = filterAssets(mockAssets, 'shared', ME);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('공동 부동산');
  });

  it('mine: filters liabilities too', () => {
    const result = filterLiabilities(mockLiabilities, 'mine', ME);
    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(100);
  });

  it('shared: filters liabilities', () => {
    const result = filterLiabilities(mockLiabilities, 'shared', ME);
    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(500);
  });

  it('empty result when no matching assets', () => {
    const onlyMine = [mockAssets[0]] as AssetWithPrice[];
    expect(filterAssets(onlyMine, 'spouse', ME)).toHaveLength(0);
  });
});
