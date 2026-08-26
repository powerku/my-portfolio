import {
  type Allocations,
  type Asset,
  type AssetCategory,
  type Currency,
  CATEGORIES,
  hasAllocations,
  isAssetCategory,
} from '@/app/lib/portfolio';
import { saveAllocations, upsertAssets } from '@/app/lib/portfolio-db';

const LEGACY_ASSETS_KEY = 'portfolio_assets';
const LEGACY_ALLOCATIONS_KEY = 'portfolio_allocations';

/** Supabase 이전에 localStorage에 저장해두던 자산 목록 */
function readLegacyAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(LEGACY_ASSETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
      .map((a) => ({
        id: typeof a.id === 'string' ? a.id : crypto.randomUUID(),
        ticker: String(a.ticker ?? '').toUpperCase(),
        category: isAssetCategory(a.category) ? a.category : ('기타' as AssetCategory),
        quantity: Number(a.quantity) || 0,
        purchasePrice: Number(a.purchasePrice) || 0,
        purchaseCurrency: (a.purchaseCurrency === 'USD' ? 'USD' : 'KRW') as Currency,
      }))
      .filter((a) => a.ticker && a.quantity > 0);
  } catch {
    return [];
  }
}

function readLegacyAllocations(): Allocations | null {
  try {
    const raw = localStorage.getItem(LEGACY_ALLOCATIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const allocations = Object.fromEntries(
      CATEGORIES.map((c) => [c, Number(parsed[c]) || 0]),
    ) as Allocations;

    return hasAllocations(allocations) ? allocations : null;
  } catch {
    return null;
  }
}

export interface MigrationResult {
  assets: Asset[] | null;
  allocations: Allocations | null;
}

/**
 * 첫 로그인 시 localStorage에 남아있던 데이터를 Supabase로 한 번 옮긴다.
 * 서버에 이미 데이터가 있으면 덮어쓰지 않고 localStorage만 정리한다.
 *
 * @returns 실제로 업로드한 데이터 (없으면 null) — 호출부에서 화면 상태를 갱신하는 데 사용
 */
export async function migrateLegacyData(
  userId: string,
  serverAssets: Asset[],
  serverAllocations: Allocations,
): Promise<MigrationResult> {
  const result: MigrationResult = { assets: null, allocations: null };

  const legacyAssets = readLegacyAssets();
  if (legacyAssets.length > 0) {
    if (serverAssets.length === 0) {
      await upsertAssets(legacyAssets, userId);
      result.assets = legacyAssets;
    }
    localStorage.removeItem(LEGACY_ASSETS_KEY);
  }

  const legacyAllocations = readLegacyAllocations();
  if (legacyAllocations) {
    if (!hasAllocations(serverAllocations)) {
      await saveAllocations(legacyAllocations, userId);
      result.allocations = legacyAllocations;
    }
    localStorage.removeItem(LEGACY_ALLOCATIONS_KEY);
  }

  return result;
}
