'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/app/components/AppHeader';
import ErrorBanner from '@/app/components/ErrorBanner';
import SectionTitle from '@/app/components/SectionTitle';
import { AllocationSkeleton } from '@/app/components/Skeleton';
import { type ErrorNotice, toNotice } from '@/app/lib/errors';
import {
  type Allocations,
  type Asset,
  type AssetCategory,
  CATEGORIES,
  CATEGORY_COLORS,
  defaultAllocations,
  hasAllocations,
} from '@/app/lib/portfolio';
import {
  type SessionUser,
  loadAllocations,
  loadAssets,
  storeAllocations,
} from '@/app/lib/portfolio-store';
import { migrateGuestData } from '@/app/lib/portfolio-migration';
import {
  type Quote,
  EXCHANGE_RATE_TICKER,
  assetValueKRW,
  fetchQuotes,
  formatKorean,
} from '@/app/lib/quotes';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.999);
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, clampedEnd);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, clampedEnd);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/** 카테고리별 원화 평가금액 합계 */
function getCategoryTotals(assets: Asset[], quotes: Record<string, Quote>, exchangeRate: number) {
  return CATEGORIES.reduce<Record<AssetCategory, number>>((acc, cat) => {
    acc[cat] = assets
      .filter((a) => a.category === cat)
      .reduce((sum, a) => sum + assetValueKRW(a, quotes[a.ticker], exchangeRate), 0);
    return acc;
  }, {} as Record<AssetCategory, number>);
}

function DonutChart({
  categoryTotals,
  total,
}: {
  categoryTotals: Record<AssetCategory, number>;
  total: number;
}) {
  const activeCategories = CATEGORIES.filter((c) => categoryTotals[c] > 0);

  const cx = 100, cy = 100, outerR = 82, innerR = 58;
  const segments: { cat: AssetCategory; path: string }[] = [];
  let startAngle = 0;

  for (const cat of activeCategories) {
    const sweepAngle = (categoryTotals[cat] / total) * 360;
    // 조각 사이에 1.5도 간격을 둬 경계가 또렷하게 보이도록 한다.
    const gap = sweepAngle > 3 ? 1.5 : 0;
    segments.push({ cat, path: arcPath(cx, cy, outerR, innerR, startAngle, startAngle + sweepAngle - gap) });
    startAngle += sweepAngle;
  }

  return (
    <section>
      <SectionTitle>자산 구성</SectionTitle>
      <div className="card flex flex-col items-center gap-7 p-6 sm:flex-row sm:gap-8">
        <div className="relative shrink-0">
          <svg viewBox="0 0 200 200" className="h-44 w-44">
            {segments.map(({ cat, path }) => (
              <path key={cat} d={path} fill={CATEGORY_COLORS[cat]} />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-medium text-gray-500">총 평가금액</span>
            <span className="tnum text-[19px] font-bold text-gray-900">{formatKorean(total)}원</span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3.5">
          {activeCategories.map((cat) => {
            const pct = (categoryTotals[cat] / total) * 100;
            return (
              <div key={cat}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="flex-1 text-[14px] font-semibold text-gray-800">{cat}</span>
                  <span className="tnum text-[14px] font-bold text-gray-900">{pct.toFixed(0)}%</span>
                  <span className="tnum w-28 text-right text-[13px] text-gray-500">
                    {Math.round(categoryTotals[cat]).toLocaleString()}원
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AllocationTable({
  categoryTotals,
  total,
  targetAllocations,
  onChangeTargetAllocations,
}: {
  categoryTotals: Record<AssetCategory, number>;
  total: number;
  targetAllocations: Allocations;
  onChangeTargetAllocations: (allocs: Allocations) => void;
}) {
  const targetSum = CATEGORIES.reduce((s, c) => s + (Number(targetAllocations[c]) || 0), 0);
  const isSumOff = targetSum > 0 && Math.abs(targetSum - 100) > 0.01;

  function handleChange(cat: AssetCategory, val: string) {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    onChangeTargetAllocations({ ...targetAllocations, [cat]: num });
  }

  return (
    <section>
      <SectionTitle
        action={
          <span
            className={`tnum chip ${isSumOff ? 'bg-warn-soft text-warn' : 'bg-gray-100 text-gray-600'}`}
          >
            합계 {Number(targetSum.toFixed(1))}%
          </span>
        }
      >
        목표 비중
      </SectionTitle>

      <div className="card px-5 py-1">
        {CATEGORIES.map((cat) => {
          const currentPct = total > 0 ? (categoryTotals[cat] / total) * 100 : 0;
          const target = Number(targetAllocations[cat]) || 0;
          const diff = currentPct - target;
          const absDiff = Math.abs(diff);
          const isAlert = target > 0 && absDiff >= 5;
          const diffColor = isAlert ? (diff > 0 ? 'text-up' : 'text-down') : 'text-gray-500';
          const diffAmount = total > 0 ? (diff / 100) * total : 0;

          return (
            <div key={cat} className="border-b border-gray-100 py-4 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="truncate text-[15px] font-semibold text-gray-900">{cat}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    value={targetAllocations[cat] === 0 ? '' : targetAllocations[cat]}
                    onChange={(e) => handleChange(cat, e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
                    aria-label={`${cat} 목표 비중`}
                    className="field field-sm tnum w-16 text-right"
                  />
                  <span className="text-[13px] font-medium text-gray-500">%</span>
                </div>
              </div>

              {/* 현재 비중 막대 위에 목표 지점을 표시해 차이를 한눈에 보여준다. */}
              <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.min(currentPct, 100)}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {target > 0 && (
                  <span
                    className="absolute top-0 h-full w-[2px] rounded-full bg-gray-900/45"
                    style={{ left: `calc(${Math.min(target, 100)}% - 1px)` }}
                  />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[12px]">
                <span className="tnum text-gray-500">
                  현재 {total > 0 ? `${currentPct.toFixed(1)}%` : '—'}
                </span>
                <span className={`tnum font-semibold ${diffColor}`}>
                  {target > 0 && total > 0
                    ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% · ${diffAmount >= 0 ? '+' : '-'}${formatKorean(Math.abs(Math.round(diffAmount)))}원`
                    : '목표 미설정'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * 자산 구성 화면.
 *
 * 보유 자산을 분류별로 묶어 지금의 구성(도넛)과 목표 비중을 나란히 보여준다.
 * 자산을 더하거나 고치는 일은 포트폴리오 화면이 맡는다. 여기서 바뀌는 값은 목표 비중뿐이다.
 *
 * 자산을 읽고 시세를 얹는 흐름은 다른 화면과 같다. (AssetManager·DividendManager)
 */
export default function AllocationManager({ user }: { user: SessionUser | null }) {
  // 로그인 사용자는 Supabase, 비로그인 사용자는 브라우저에서 읽는다. (portfolio-store)
  const userId = user?.id ?? null;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [exchangeRate, setExchangeRate] = useState(0);
  const [targetAllocations, setTargetAllocations] = useState<Allocations>(defaultAllocations);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<ErrorNotice | null>(null);
  /** 값을 올릴 때마다 최초 로드를 다시 돌린다. (오류 띠의 '다시 시도') */
  const [reloadKey, setReloadKey] = useState(0);

  const allocationSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [storedAssets, storedAllocations] = await Promise.all([
          loadAssets(userId),
          loadAllocations(userId),
        ]);
        if (cancelled) return;

        // 로그인했다면 비로그인 때 브라우저에 담아둔 데이터를 한 번 옮긴다.
        const migrated = userId
          ? await migrateGuestData(userId, storedAssets, storedAllocations)
          : { assets: null, allocations: null };
        if (cancelled) return;

        setAssets(migrated.assets ?? storedAssets);

        // 저장된 목표 비중이 하나도 없으면 기본 배분을 보여준다. (값을 건드릴 때 저장된다)
        const allocations = migrated.allocations ?? storedAllocations;
        setTargetAllocations(hasAllocations(allocations) ? allocations : defaultAllocations());
      } catch (e) {
        if (!cancelled) {
          setSyncError({ ...toNotice(e, '자산 구성을 불러오지 못했습니다.'), retryable: true });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  /** 처음부터 다시 읽어온다. 저장에 실패한 뒤에도 서버의 진짜 상태로 되돌리는 길이 된다. */
  const reload = useCallback(() => {
    setSyncError(null);
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  // 목표 비중은 입력할 때마다 저장하면 요청이 과해지므로 잠깐 모았다가 저장한다.
  const scheduleAllocationSave = useCallback(
    (next: Allocations) => {
      if (allocationSaveTimerRef.current) clearTimeout(allocationSaveTimerRef.current);
      allocationSaveTimerRef.current = setTimeout(() => {
        storeAllocations(userId, next).catch((e) =>
          setSyncError(toNotice(e, '목표 비중을 저장하지 못했습니다.')),
        );
      }, 600);
    },
    [userId],
  );

  useEffect(() => {
    return () => {
      if (allocationSaveTimerRef.current) clearTimeout(allocationSaveTimerRef.current);
    };
  }, []);

  function handleAllocationsChange(next: Allocations) {
    setSyncError(null);
    setTargetAllocations(next);
    scheduleAllocationSave(next);
  }

  // 보유 티커 목록. 구성이 바뀔 때만 시세를 다시 불러오도록 문자열로 만든다.
  const tickerKey = [...new Set(assets.map((a) => a.ticker))].sort().join(',');

  // 환율과 보유 종목 시세를 한 번의 요청으로 가져온다.
  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;
    const tickers = tickerKey ? tickerKey.split(',') : [];

    (async () => {
      const result = await fetchQuotes([EXCHANGE_RATE_TICKER, ...tickers]);
      if (cancelled) return;

      const rate = result[EXCHANGE_RATE_TICKER];
      if (rate?.price != null && rate.price > 0) setExchangeRate(rate.price);
      setQuotes((prev) => ({ ...prev, ...result }));
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, tickerKey]);

  // 환율이 로드된 경우에만 USD 변환 적용 (미로드 시 0이므로 purchasePrice 기준 원화 fallback)
  const rate = exchangeRate > 0 ? exchangeRate : 1;

  const categoryTotals = getCategoryTotals(assets, quotes, rate);
  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  // 상단 바는 이미 그릴 수 있으므로 그대로 두고 본문만 스켈레톤으로 채운다.
  if (isLoading) {
    return (
      <>
        <AppHeader user={user} exchangeRate={exchangeRate} active="/allocation" />
        <AllocationSkeleton />
      </>
    );
  }

  return (
    <>
      <AppHeader user={user} exchangeRate={exchangeRate} active="/allocation" />

      <main className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
        {syncError && (
          <ErrorBanner notice={syncError} onRetry={syncError.retryable ? reload : undefined} />
        )}

        {/* 시세가 아직 안 와서 합계가 0일 수도 있다. 이때 도넛은 그릴 게 없으므로 비운다. */}
        {total > 0 ? (
          <DonutChart categoryTotals={categoryTotals} total={total} />
        ) : (
          <section>
            <SectionTitle>자산 구성</SectionTitle>
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-[20px]">🥧</span>
              <p className="mt-4 text-[15px] font-semibold text-gray-900">
                {assets.length > 0 ? '아직 평가금액을 계산하지 못했어요' : '보여줄 자산이 없어요'}
              </p>
              <p className="mt-1 text-[13px] text-gray-500">
                {assets.length > 0
                  ? '시세를 불러오는 중이거나 시세를 받지 못한 종목뿐이에요.'
                  : '포트폴리오 화면에서 종목을 먼저 등록해 주세요.'}
              </p>
              {assets.length === 0 && (
                <Link href="/" className="btn btn-primary mt-5 rounded-[10px] px-4 py-2 text-[13px]">
                  자산 등록하러 가기
                </Link>
              )}
            </div>
          </section>
        )}

        {/* 목표 비중 */}
        <AllocationTable
          categoryTotals={categoryTotals}
          total={total}
          targetAllocations={targetAllocations}
          onChangeTargetAllocations={handleAllocationsChange}
        />
      </main>
    </>
  );
}
