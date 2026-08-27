/**
 * 자산·목표 비중 저장소 진입점.
 *
 * 로그인 사용자는 Supabase(`portfolio-db`), 비로그인 사용자는 브라우저
 * (`portfolio-local`)에 저장한다. 화면은 어디에 저장되는지 몰라도 되도록
 * userId(없으면 null)만 넘기고 이 파일에서 갈라준다.
 */

import { type Allocations, type Asset, emptyAllocations } from '@/app/lib/portfolio';
import * as db from '@/app/lib/portfolio-db';
import * as local from '@/app/lib/portfolio-local';

/** 화면에 내려주는 로그인 정보. 비로그인은 null. */
export interface SessionUser {
  id: string;
  email: string;
}

export async function loadAssets(userId: string | null): Promise<Asset[]> {
  return userId ? db.fetchAssets() : local.readAssets();
}

export async function saveAsset(userId: string | null, asset: Asset): Promise<void> {
  if (userId) await db.upsertAsset(asset, userId);
  else local.upsertAsset(asset);
}

export async function saveAssets(userId: string | null, assets: Asset[]): Promise<void> {
  if (userId) await db.upsertAssets(assets, userId);
  else local.writeAssets([...local.readAssets(), ...assets]);
}

export async function removeAsset(userId: string | null, id: string): Promise<void> {
  if (userId) await db.deleteAsset(id);
  else local.removeAsset(id);
}

/** 저장된 목표 비중. 설정한 적이 없으면 전부 0으로 돌려준다. */
export async function loadAllocations(userId: string | null): Promise<Allocations> {
  if (userId) return db.fetchAllocations();
  return local.readAllocations() ?? emptyAllocations();
}

export async function storeAllocations(
  userId: string | null,
  allocations: Allocations,
): Promise<void> {
  if (userId) await db.saveAllocations(allocations, userId);
  else local.writeAllocations(allocations);
}
