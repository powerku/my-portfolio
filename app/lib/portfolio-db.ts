import { createClient } from '@/app/lib/supabase/client';
import {
  type Allocations,
  type Asset,
  type AssetCategory,
  type Currency,
  CATEGORIES,
  emptyAllocations,
  isAssetCategory,
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
    category: isAssetCategory(row.category) ? row.category : '기타',
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

export async function fetchAssets(): Promise<Asset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('assets')
    .select('id, user_id, ticker, category, quantity, purchase_price, purchase_currency')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as AssetRow[]).map(rowToAsset);
}

/** 신규 등록 / 수정 모두 upsert로 처리 (id는 클라이언트에서 crypto.randomUUID로 생성) */
export async function upsertAsset(asset: Asset, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('assets').upsert(assetToRow(asset, userId));
  if (error) throw error;
}

export async function upsertAssets(assets: Asset[], userId: string): Promise<void> {
  if (assets.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from('assets').upsert(assets.map((a) => assetToRow(a, userId)));
  if (error) throw error;
}

export async function deleteAsset(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAllocations(): Promise<Allocations> {
  const supabase = createClient();
  const { data, error } = await supabase.from('allocations').select('category, target_pct');
  if (error) throw error;

  const allocations = emptyAllocations();
  for (const row of data as { category: string; target_pct: number }[]) {
    if (isAssetCategory(row.category)) {
      allocations[row.category] = Number(row.target_pct);
    }
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
  const { error } = await supabase.from('allocations').upsert(rows, { onConflict: 'user_id,category' });
  if (error) throw error;
}
