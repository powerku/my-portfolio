import { createClient } from '@/app/lib/supabase/client';
import { withAuthRetry } from '@/app/lib/supabase/session';
import {
  type Allocations,
  type Asset,
  type AssetCategory,
  type Currency,
  CATEGORIES,
  emptyAllocations,
  knownCategory,
  toAssetCategory,
} from '@/app/lib/portfolio';

/** Supabase `assets` 테이블 행 */
interface AssetRow {
  id: string;
  user_id: string;
  ticker: string;
  category: string;
  quantity: number;
  purchase_price: number;
  purchase_currency: string;
}

function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    ticker: row.ticker,
    category: toAssetCategory(row.category),
    quantity: Number(row.quantity),
    purchasePrice: Number(row.purchase_price),
    purchaseCurrency: row.purchase_currency === 'USD' ? 'USD' : ('KRW' as Currency),
  };
}

function assetToRow(asset: Asset, userId: string) {
  return {
    id: asset.id,
    user_id: userId,
    ticker: asset.ticker,
    category: asset.category,
    quantity: asset.quantity,
    purchase_price: asset.purchasePrice,
    purchase_currency: asset.purchaseCurrency,
  };
}

/*
 * 아래 호출은 모두 withAuthRetry를 거친다. 만료된 토큰으로 나간 요청을 한 번 되살리고,
 * 살아나지 않으면 SessionExpiredError로 바꿔 화면이 "다시 로그인"을 안내하게 한다.
 * (app/lib/supabase/session.ts)
 */

export async function fetchAssets(): Promise<Asset[]> {
  const supabase = createClient();
  const rows = await withAuthRetry<AssetRow[]>(() =>
    supabase
      .from('assets')
      .select('id, user_id, ticker, category, quantity, purchase_price, purchase_currency')
      .order('created_at', { ascending: true }),
  );

  return (rows ?? []).map(rowToAsset);
}

/** 신규 등록 / 수정 모두 upsert로 처리 (id는 클라이언트에서 crypto.randomUUID로 생성) */
export async function upsertAsset(asset: Asset, userId: string): Promise<void> {
  const supabase = createClient();
  await withAuthRetry(() => supabase.from('assets').upsert(assetToRow(asset, userId)));
}

export async function upsertAssets(assets: Asset[], userId: string): Promise<void> {
  if (assets.length === 0) return;
  const supabase = createClient();
  await withAuthRetry(() => supabase.from('assets').upsert(assets.map((a) => assetToRow(a, userId))));
}

export async function deleteAsset(id: string): Promise<void> {
  const supabase = createClient();
  await withAuthRetry(() => supabase.from('assets').delete().eq('id', id));
}

export async function fetchAllocations(): Promise<Allocations> {
  const supabase = createClient();
  const rows = await withAuthRetry<{ category: string; target_pct: number }[]>(() =>
    supabase.from('allocations').select('category, target_pct'),
  );

  const allocations = emptyAllocations();
  for (const row of rows ?? []) {
    const category = knownCategory(row.category);
    if (category) allocations[category] = Number(row.target_pct);
  }
  return allocations;
}

export async function saveAllocations(allocations: Allocations, userId: string): Promise<void> {
  const supabase = createClient();
  const rows = CATEGORIES.map((category: AssetCategory) => ({
    user_id: userId,
    category,
    target_pct: allocations[category] ?? 0,
  }));
  await withAuthRetry(() => supabase.from('allocations').upsert(rows, { onConflict: 'user_id,category' }));
}
