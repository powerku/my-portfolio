import { type Allocations, type Asset, hasAllocations } from '@/app/lib/portfolio';
import { saveAllocations, upsertAssets } from '@/app/lib/portfolio-db';
import * as local from '@/app/lib/portfolio-local';
import { markSeeded } from '@/app/lib/portfolio-seed';

export interface MigrationResult {
  assets: Asset[] | null;
  allocations: Allocations | null;
}

/**
 * 로그인하면 비로그인 상태에서 브라우저에 담아둔 데이터를 Supabase로 한 번 옮긴다.
 * 서버에 이미 데이터가 있으면 덮어쓰지 않고 브라우저 쪽만 정리한다.
 *
 * @returns 실제로 업로드한 데이터 (없으면 null) — 호출부에서 화면 상태를 갱신하는 데 사용
 */
export async function migrateGuestData(
  userId: string,
  serverAssets: Asset[],
  serverAllocations: Allocations,
): Promise<MigrationResult> {
  const result: MigrationResult = { assets: null, allocations: null };

  const localAssets = local.readAssets();
  if (localAssets.length > 0) {
    if (serverAssets.length === 0) {
      await upsertAssets(localAssets, userId);
      result.assets = localAssets;
    }
    local.clearAssets();
  }

  const localAllocations = local.readAllocations();
  if (localAllocations) {
    if (!hasAllocations(serverAllocations)) {
      await saveAllocations(localAllocations, userId);
      result.allocations = localAllocations;
    }
    local.clearAllocations();
  }

  // 기본 포트폴리오를 이미 받았다는 표시도 넘겨받는다. 이걸 빼면 비로그인 때 자산을
  // 전부 지운 사용자가 로그인하는 순간 기본 포트폴리오가 다시 채워진다.
  if (local.readSeeded()) {
    await markSeeded(userId);
    local.clearSeeded();
  }

  return result;
}
