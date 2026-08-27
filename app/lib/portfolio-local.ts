/**
 * 비로그인 상태에서 쓰는 브라우저 저장소.
 *
 * 로그인 전에도 화면을 그대로 쓸 수 있어야 하므로 자산·목표 비중을 localStorage에 둔다.
 * 키는 Supabase를 붙이기 전에 쓰던 것과 같다. 로그인하면 `portfolio-migration`이
 * 이 데이터를 Supabase로 한 번 옮기고 여기서 지운다.
 *
 * 읽기는 값이 깨져 있어도 화면이 뜨도록 조용히 비운다. 쓰기는 실패를 알려야 하므로
 * (용량 초과·사파리 시크릿 모드) 예외를 그대로 올려보낸다.
 */

import {
  type Allocations,
  type Asset,
  type Currency,
  emptyAllocations,
  hasAllocations,
  knownCategory,
  toAssetCategory,
} from '@/app/lib/portfolio';

const ASSETS_KEY = 'portfolio_assets';
const ALLOCATIONS_KEY = 'portfolio_allocations';
/** 기본 포트폴리오를 한 번 채웠다는 표시 (로그인 사용자는 Supabase 메타데이터에 남긴다) */
const SEEDED_KEY = 'portfolio_default_seeded';

/** 서버 렌더링 중에는 localStorage가 없다. */
function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readJSON(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  const store = storage();
  if (!store) return;
  store.setItem(key, JSON.stringify(value));
}

export function readAssets(): Asset[] {
  const parsed = readJSON(ASSETS_KEY);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map((a) => ({
      id: typeof a.id === 'string' ? a.id : crypto.randomUUID(),
      ticker: String(a.ticker ?? '').toUpperCase(),
      category: toAssetCategory(a.category),
      quantity: Number(a.quantity) || 0,
      purchasePrice: Number(a.purchasePrice) || 0,
      purchaseCurrency: (a.purchaseCurrency === 'USD' ? 'USD' : 'KRW') as Currency,
    }))
    .filter((a) => a.ticker && a.quantity > 0);
}

export function writeAssets(assets: Asset[]): void {
  write(ASSETS_KEY, assets);
}

/** 신규 등록 / 수정 모두 같은 자리에 덮어쓴다 (id 기준) */
export function upsertAsset(asset: Asset): void {
  const assets = readAssets();
  const index = assets.findIndex((a) => a.id === asset.id);
  if (index === -1) assets.push(asset);
  else assets[index] = asset;
  writeAssets(assets);
}

export function removeAsset(id: string): void {
  writeAssets(readAssets().filter((a) => a.id !== id));
}

/** 저장된 목표 비중. 없거나 전부 0이면 null (호출부에서 기본 배분을 쓴다) */
export function readAllocations(): Allocations | null {
  const parsed = readJSON(ALLOCATIONS_KEY);
  if (typeof parsed !== 'object' || parsed === null) return null;

  // 예전 이름으로 담긴 값도 새 분류에 얹는다. (portfolio.ts RENAMED_CATEGORIES)
  const allocations = emptyAllocations();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const category = knownCategory(key);
    if (category) allocations[category] = Number(value) || 0;
  }

  return hasAllocations(allocations) ? allocations : null;
}

export function writeAllocations(allocations: Allocations): void {
  write(ALLOCATIONS_KEY, allocations);
}

export function readSeeded(): boolean {
  return storage()?.getItem(SEEDED_KEY) === 'true';
}

export function writeSeeded(): void {
  storage()?.setItem(SEEDED_KEY, 'true');
}

export function clearAssets(): void {
  storage()?.removeItem(ASSETS_KEY);
}

export function clearAllocations(): void {
  storage()?.removeItem(ALLOCATIONS_KEY);
}

export function clearSeeded(): void {
  storage()?.removeItem(SEEDED_KEY);
}
