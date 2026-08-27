export type AssetCategory = '해외주식' | '해외채권' | '국내주식' | '국내채권' | '대체투자' | '암호화폐' | '기타';
export type Currency = 'KRW' | 'USD';

export const CATEGORIES: AssetCategory[] = ['해외주식', '해외채권', '국내주식', '국내채권', '대체투자', '암호화폐', '기타'];

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  '해외주식': '#3B82F6',
  '해외채권': '#10B981',
  '국내주식': '#F59E0B',
  '국내채권': '#8B5CF6',
  '대체투자': '#F97316',
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
  '해외주식': 35.2,
  '국내주식': 29.4,
  '국내채권': 15.7,
  '대체투자': 13.8,
  '해외채권': 5.8,
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

/**
 * 이름이 바뀌기 전에 저장된 분류.
 *
 * 분류 이름을 값 그대로 저장소(Supabase `category` 열, localStorage)에 담기 때문에,
 * 이름을 바꾸면 이미 저장된 자산이 어느 분류에도 걸리지 않는다. 읽을 때 새 이름으로
 * 바꿔주면 사용자가 아무것도 하지 않아도 예전 자산이 그대로 보인다.
 * (저장된 값 자체를 옮기는 건 `supabase/schema.sql` 아래 마이그레이션이 한다)
 */
const RENAMED_CATEGORIES: Record<string, AssetCategory> = {
  '미국주식': '해외주식',
  '미국채권': '해외채권',
  '금': '대체투자',
};

/** 저장된 분류 값에 대응하는 현재 분류. 아는 분류가 아니면 null */
export function knownCategory(value: unknown): AssetCategory | null {
  if (isAssetCategory(value)) return value;
  if (typeof value === 'string' && value in RENAMED_CATEGORIES) return RENAMED_CATEGORIES[value];
  return null;
}

/** 저장된 분류 값을 현재 분류로 읽는다. 알 수 없는 값은 '기타'로 둔다. */
export function toAssetCategory(value: unknown): AssetCategory {
  return knownCategory(value) ?? '기타';
}
