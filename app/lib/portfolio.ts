export type AssetCategory = '미국주식' | '미국채권' | '국내주식' | '국내채권' | '금' | '암호화폐' | '기타';
export type Currency = 'KRW' | 'USD';

export const CATEGORIES: AssetCategory[] = ['미국주식', '미국채권', '국내주식', '국내채권', '금', '암호화폐', '기타'];

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  '미국주식': '#3B82F6',
  '미국채권': '#10B981',
  '국내주식': '#F59E0B',
  '국내채권': '#8B5CF6',
  '금': '#F97316',
  '암호화폐': '#F7931A',
  '기타': '#6B7280',
};

export interface Asset {
  id: string;
  ticker: string;
  quantity: number;
  purchasePrice: number; // 저장 통화: purchaseCurrency 기준
  category: AssetCategory;
  purchaseCurrency: Currency;
}

export type Allocations = Record<AssetCategory, number>;

export function emptyAllocations(): Allocations {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Allocations;
}

/** 저장된 목표 비중이 없을 때 처음 보여줄 기본 배분 */
const DEFAULT_TARGET_PCT: Partial<Record<AssetCategory, number>> = {
  '미국주식': 35.2,
  '국내주식': 29.4,
  '국내채권': 15.7,
  '금': 13.8,
  '미국채권': 5.8,
};

export function defaultAllocations(): Allocations {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c, DEFAULT_TARGET_PCT[c] ?? 0]),
  ) as Allocations;
}

/** 목표 비중이 하나라도 설정돼 있는지 */
export function hasAllocations(allocations: Allocations): boolean {
  return CATEGORIES.some((c) => (allocations[c] ?? 0) > 0);
}

export function isAssetCategory(value: unknown): value is AssetCategory {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value);
}
