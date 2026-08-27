/**
 * 처음 들어온 사용자에게 기본 포트폴리오를 한 번 채워 넣는다.
 *
 * "처음"은 자산이 비어 있는 것만으로는 판단할 수 없다. (사용자가 자산을 전부
 * 지웠을 때 다시 채워 넣으면 지운 게 되살아난다) 그래서 한 번 채웠다는 표시를
 * 따로 남긴다. 로그인 사용자는 Supabase 사용자 메타데이터에 남겨 기기가 바뀌어도
 * 유지되고, 비로그인 사용자는 데이터와 같은 곳(localStorage)에 남긴다.
 */

import type { User } from '@supabase/supabase-js';
import { type Asset } from '@/app/lib/portfolio';
import { type DefaultAsset } from '@/app/lib/portfolio-defaults';
import * as local from '@/app/lib/portfolio-local';
import { saveAssets } from '@/app/lib/portfolio-store';
import { createClient } from '@/app/lib/supabase/client';
import { withAuthRetry } from '@/app/lib/supabase/session';

/** 사용자 메타데이터에 남기는 "기본 포트폴리오를 채웠다" 표시 */
const SEEDED_FLAG = 'default_assets_seeded';

async function fetchDefaultAssets(): Promise<DefaultAsset[]> {
  const res = await fetch('/api/default-assets');
  if (!res.ok) throw new Error(`시세를 불러오지 못했습니다. (${res.status})`);

  const data = await res.json();
  return Array.isArray(data) ? (data as DefaultAsset[]) : [];
}

/*
 * 로그인 사용자의 표시는 사용자 메타데이터에 있어서 읽고 쓰는 데 유효한 토큰이 필요하다.
 * 만료된 토큰은 withAuthRetry가 한 번 되살린다. 그래도 안 되면 오류를 올려보낸다.
 * 여기서 "표시가 없다"로 넘어가면 이미 채운 사용자에게 기본 포트폴리오를 또 채우게 된다.
 */
async function hasSeeded(userId: string | null): Promise<boolean> {
  if (!userId) return local.readSeeded();

  const supabase = createClient();
  const data = await withAuthRetry<{ user: User | null }>(() => supabase.auth.getUser());

  return Boolean(data?.user?.user_metadata?.[SEEDED_FLAG]);
}

/** 기본 포트폴리오를 채웠다고 표시한다. 로그인 시 비로그인 표시를 넘겨받을 때도 쓴다. */
export async function markSeeded(userId: string | null): Promise<void> {
  if (!userId) {
    local.writeSeeded();
    return;
  }

  const supabase = createClient();
  await withAuthRetry<{ user: User | null }>(() =>
    supabase.auth.updateUser({ data: { [SEEDED_FLAG]: true } }),
  );
}

/**
 * 아직 기본 포트폴리오를 받지 않은 사용자라면 채워서 저장한다.
 *
 * @returns 저장한 자산 목록. 이미 받았거나 구성할 종목이 없으면 null.
 */
export async function seedDefaultAssets(userId: string | null): Promise<Asset[] | null> {
  if (await hasSeeded(userId)) return null;

  const defaults = await fetchDefaultAssets();
  if (defaults.length === 0) return null;

  const assets: Asset[] = defaults.map((a) => ({ ...a, id: crypto.randomUUID() }));
  await saveAssets(userId, assets);

  // 표시를 남기지 못해도 자산은 이미 저장됐다. 다음 방문에는 자산이 있으므로
  // 다시 채워지지 않는다. 여기서 오류를 올려보내면 저장까지 실패한 것처럼 보인다.
  try {
    await markSeeded(userId);
  } catch {
    // 무시
  }

  return assets;
}
