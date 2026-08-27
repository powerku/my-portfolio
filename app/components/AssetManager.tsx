'use client';

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import AppHeader from '@/app/components/AppHeader';
import { PortfolioSkeleton } from '@/app/components/Skeleton';
import {
  type Allocations,
  type Asset,
  type AssetCategory,
  type Currency,
  CATEGORIES,
  CATEGORY_COLORS,
  defaultAllocations,
  hasAllocations,
} from '@/app/lib/portfolio';
import {
  type SessionUser,
  loadAllocations,
  loadAssets,
  removeAsset as removeAssetFromStore,
  saveAsset,
  storeAllocations,
} from '@/app/lib/portfolio-store';
import { migrateGuestData } from '@/app/lib/portfolio-migration';
import { seedDefaultAssets } from '@/app/lib/portfolio-seed';
import { resolveAssetName } from '@/app/lib/kr-assets';
import {
  type Quote,
  EXCHANGE_RATE_TICKER,
  assetValueKRW,
  fetchQuotes,
  formatKRW,
  formatKorean,
  quotePriceToKRW,
  toKRW,
  toMessage,
} from '@/app/lib/quotes';

interface SearchResult {
  ticker: string;
  name: string;
  typeDisp: string;
}

/** 통화 선택 세그먼트 컨트롤 */
function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-gray-100 p-0.5 text-[12px] font-semibold">
      {(['KRW', 'USD'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`rounded-lg px-2.5 py-1 transition-colors ${
            value === c
              ? 'bg-raised text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {c === 'KRW' ? '₩ 원' : '$ 달러'}
        </button>
      ))}
    </div>
  );
}

/** 티커로 쓸 수 있는 글자만 있는지 (한글 종목명을 티커로 저장하지 않기 위한 검사) */
function looksLikeTicker(value: string) {
  return /^[A-Za-z0-9.\-=^]+$/.test(value);
}

/**
 * 종목 검색 상태.
 *
 * 입력칸에는 종목명만 보여주고 티커는 안에서만 들고 있는다. 저장에 쓸 값은
 * `ticker`인데, 목록에서 고른 종목이 있으면 그 티커이고 없으면 입력한 글자가
 * 티커 형태일 때만 인정한다. (`AAPL`처럼 코드를 바로 입력하는 경우)
 *
 * `initial`을 주면(자산 수정) 검색 결과가 오기 전에도 이름과 코드를 채워둘 수 있다.
 */
function useTickerSearch(initial?: { ticker: string; name: string }) {
  const [query, setQueryState] = useState(initial?.name.trim() ?? '');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<{ ticker: string; name: string } | null>(
    initial ? { ticker: initial.ticker.toUpperCase(), name: initial.name.trim() } : null,
  );
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  // 고른 종목의 이름을 지우거나 고쳤으면 그 종목을 고른 것으로 보지 않는다.
  // 양쪽 모두 다듬어서 견주므로 종목명에 붙은 공백 때문에 어긋나지는 않는다.
  const picked = selected && selected.name.trim() === trimmed ? selected : null;
  const ticker = picked?.ticker ?? (looksLikeTicker(trimmed) ? trimmed.toUpperCase() : '');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function setQuery(value: string) {
    setQueryState(value);
    setActiveIndex(-1);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        const data: SearchResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, onSelect?: (item: SearchResult) => void) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex], onSelect);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  function selectSuggestion(item: SearchResult, onSelect?: (item: SearchResult) => void) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    // 입력칸에는 이름을 남기고, 저장에 쓸 티커는 selected에 담아둔다.
    const name = item.name.trim();
    setQueryState(name);
    setSelected({ ticker: item.ticker.toUpperCase(), name });
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    onSelect?.(item);
  }

  function reset() {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setQueryState('');
    setSelected(null);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  }

  return { query, setQuery, ticker, suggestions, showDropdown, activeIndex, isSearching, wrapperRef, handleKeyDown, selectSuggestion, reset };
}

function TickerInput({
  value,
  onChange,
  suggestions,
  showDropdown,
  activeIndex,
  isSearching,
  wrapperRef,
  onKeyDown,
  onSelect,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: SearchResult[];
  showDropdown: boolean;
  activeIndex: number;
  isSearching: boolean;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (item: SearchResult) => void;
  onFocus?: () => void;
}) {
  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="종목명 검색 (예: 삼성전자, AAPL)"
        autoComplete="off"
        className="field"
      />
      {isSearching && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-medium text-gray-400">
          검색 중
        </span>
      )}
      {showDropdown && (
        <ul className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-surface py-1 pop">
          {suggestions.map((item, idx) => (
            <li
              key={item.ticker}
              onMouseDown={() => onSelect(item)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                idx === activeIndex ? 'bg-brand-soft' : 'hover:bg-gray-50'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-gray-900">{item.name}</span>
                <span className="block text-[12px] text-gray-500">{item.ticker}</span>
              </span>
              {item.typeDisp && (
                <span className="chip shrink-0 bg-gray-100 text-gray-500">{item.typeDisp}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 달러 금액 입력 필드 ($ 접두사 포함) */
function USDInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-gray-500">
        $
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min="0"
        step="any"
        className="field tnum pl-8"
      />
    </div>
  );
}

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

/** 한 종목의 원화 기준 지표. 시세가 없으면 현재가·손익은 null이다. */
function getAssetMetrics(asset: Asset, quote: Quote | undefined, exchangeRate: number) {
  const currentPriceKRW = quote?.price != null ? quotePriceToKRW(quote.price, asset, exchangeRate) : null;
  const purchasePriceKRW = toKRW(asset.purchasePrice, asset.purchaseCurrency, exchangeRate);

  return {
    currentPriceKRW,
    purchasePriceKRW,
    evalAmount: currentPriceKRW != null ? currentPriceKRW * asset.quantity : null,
    pnl: currentPriceKRW != null ? (currentPriceKRW - purchasePriceKRW) * asset.quantity : null,
    pnlPct: currentPriceKRW != null ? ((currentPriceKRW - purchasePriceKRW) / purchasePriceKRW) * 100 : null,
  };
}

/** 부호를 붙인 금액 표기 */
function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${formatKRW(value)}`;
}

/** 분류 색을 쓴 티커 배지 */
function TickerAvatar({ asset }: { asset: Asset }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: CATEGORY_COLORS[asset.category] }}
    >
      {asset.ticker.slice(0, 2)}
    </span>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold text-gray-900">{children}</h2>
      {action}
    </div>
  );
}

function DonutChart({
  assets,
  quotes,
  exchangeRate,
}: {
  assets: Asset[];
  quotes: Record<string, Quote>;
  exchangeRate: number;
}) {
  const categoryTotals = getCategoryTotals(assets, quotes, exchangeRate);

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

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

// 수정 모달 컴포넌트
function EditModal({
  asset,
  assetName,
  onSave,
  onClose,
}: {
  asset: Asset;
  assetName: string;
  onSave: (updated: Asset) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<AssetCategory>(asset.category);
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>(asset.purchaseCurrency);
  const [quantity, setQuantity] = useState(String(asset.quantity));
  const [purchasePrice, setPurchasePrice] = useState(String(asset.purchasePrice));
  const [error, setError] = useState('');
  // 코드와 이름을 채운 상태로 열어 검색 없이도 어떤 종목인지 보이게 한다.
  const search = useTickerSearch({ ticker: asset.ticker, name: assetName });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (!search.ticker) {
      setError(search.query.trim() ? '목록에서 종목을 선택해주세요.' : '종목명을 입력해주세요.');
      return;
    }
    if (!qty || qty <= 0) {
      setError('수량을 올바르게 입력해주세요.');
      return;
    }
    if (!price || price <= 0) {
      setError('매수 단가를 올바르게 입력해주세요.');
      return;
    }

    onSave({
      ...asset,
      ticker: search.ticker,
      category,
      quantity: qty,
      purchasePrice: price,
      purchaseCurrency,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] bg-surface p-6 pb-8 pop sm:rounded-[24px] sm:pb-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
        <h3 className="mb-5 text-[20px] font-bold text-gray-900">자산 수정</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">종목명</label>
            <TickerInput
              value={search.query}
              onChange={search.setQuery}
              suggestions={search.suggestions}
              showDropdown={search.showDropdown}
              activeIndex={search.activeIndex}
              isSearching={search.isSearching}
              wrapperRef={search.wrapperRef}
              onKeyDown={(e) => search.handleKeyDown(e)}
              onSelect={(item) => search.selectSuggestion(item)}
            />
          </div>
          <div>
            <label className="label">자산 분류</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className="field field-select"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">수량</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="예: 0.001"
                min="0"
                step="any"
                className="field tnum"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label mb-0">매수 단가</label>
                <CurrencyToggle value={purchaseCurrency} onChange={setPurchaseCurrency} />
              </div>
              {purchaseCurrency === 'USD' ? (
                <USDInput
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  placeholder="예: 185.50"
                />
              ) : (
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="예: 28000"
                  min="0"
                  step="any"
                  className="field tnum"
                />
              )}
            </div>
          </div>
          {error && <p className="text-[13px] font-medium text-up">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-md flex-1">
              취소
            </button>
            <button type="submit" className="btn btn-primary btn-md flex-[1.6]">
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllocationTable({
  assets,
  quotes,
  exchangeRate,
  targetAllocations,
  onChangeTargetAllocations,
}: {
  assets: Asset[];
  quotes: Record<string, Quote>;
  exchangeRate: number;
  targetAllocations: Allocations;
  onChangeTargetAllocations: (allocs: Allocations) => void;
}) {
  const categoryTotals = getCategoryTotals(assets, quotes, exchangeRate);

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
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

type SortKey = 'ticker' | 'category' | 'currentPrice' | 'changePercent' | 'quantity' | 'evalAmount' | 'purchasePrice' | 'pnl';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-0.5 inline-block text-[9px] ${active ? 'text-brand' : 'text-gray-300'}`}>
      {active && dir === 'desc' ? '▼' : '▲'}
    </span>
  );
}

/** 한 열에 정렬 기준이 여럿 들어간다 (예: `현재가 · 등락`). 각 기준이 눌러서 정렬되는 버튼이다. */
function SortHeader({
  keys,
  activeKey,
  dir,
  onSort,
  align = 'right',
}: {
  keys: SortKey[];
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`whitespace-nowrap px-3 py-3 ${align === 'left' ? 'text-left' : 'text-right'}`}>
      <span className="inline-flex items-center gap-1">
        {keys.map((key, i) => (
          <Fragment key={key}>
            {i > 0 && <span aria-hidden="true" className="text-gray-300">·</span>}
            <button
              type="button"
              onClick={() => onSort(key)}
              className={`inline-flex items-center transition-colors hover:text-gray-900 ${
                activeKey === key ? 'text-gray-900' : ''
              }`}
            >
              {SORT_LABELS[key]}
              <SortIcon active={activeKey === key} dir={dir} />
            </button>
          </Fragment>
        ))}
      </span>
    </th>
  );
}

/** 정렬 기준 이름. 표 머리글과 모바일 정렬 선택이 같은 목록을 쓴다. */
const SORT_LABELS: Record<SortKey, string> = {
  ticker: '종목',
  category: '분류',
  currentPrice: '현재가',
  changePercent: '등락',
  quantity: '수량',
  evalAmount: '평가금액',
  purchasePrice: '매수단가',
  pnl: '평가손익',
};

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

/**
 * 표의 열 구성. 지표 하나에 열 하나를 주면 가로 스크롤이 생기므로,
 * 짝이 되는 지표(현재가-등락, 수량-매수단가, 평가금액-평가손익)를 한 열에 위아래로 묶는다.
 */
const TABLE_COLUMNS: { keys: SortKey[]; align?: 'left' | 'right' }[] = [
  { keys: ['ticker', 'category'], align: 'left' },
  { keys: ['currentPrice', 'changePercent'] },
  { keys: ['quantity', 'purchasePrice'] },
  { keys: ['evalAmount', 'pnl'] },
];

/** 표 머리글을 누를 수 없는 좁은 화면에서 쓰는 정렬 컨트롤 */
function SortControl({
  sortKey,
  sortDir,
  onChangeKey,
  onToggleDir,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onChangeKey: (key: SortKey) => void;
  onToggleDir: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {/* .field의 16px 글꼴을 유지해야 iOS에서 포커스 시 화면이 확대되지 않는다. */}
      <select
        value={sortKey}
        onChange={(e) => onChangeKey(e.target.value as SortKey)}
        aria-label="정렬 기준"
        className="field field-select w-auto rounded-[12px] py-2 pl-3.5 pr-9 font-semibold"
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>{SORT_LABELS[key]}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onToggleDir}
        aria-label={sortDir === 'asc' ? '오름차순, 눌러서 내림차순으로' : '내림차순, 눌러서 오름차순으로'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gray-100 text-[11px] text-gray-600 transition-colors hover:bg-gray-200"
      >
        {sortDir === 'desc' ? '▼' : '▲'}
      </button>
    </div>
  );
}

/** 매수 단가 (달러 매수는 원화 환산을 함께 보여준다) */
function PurchasePrice({
  asset,
  purchasePriceKRW,
  showApprox,
  inline = false,
}: {
  asset: Asset;
  purchasePriceKRW: number;
  showApprox: boolean;
  /** 표에서는 줄 수를 늘리지 않도록 환산액을 같은 줄에 붙인다 */
  inline?: boolean;
}) {
  if (asset.purchaseCurrency !== 'USD') {
    return (
      <span className={inline ? undefined : 'block'}>{asset.purchasePrice.toLocaleString()}원</span>
    );
  }
  const approx = showApprox && (
    <span className={`${inline ? 'ml-1' : 'block'} text-[12px] font-normal text-gray-400`}>
      ≈ {formatKRW(purchasePriceKRW)}원
    </span>
  );
  return (
    <>
      <span className={inline ? undefined : 'block'}>
        ${asset.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
      {approx}
    </>
  );
}

/** 표가 들어가지 않는 좁은 화면용 자산 카드 */
function AssetCard({
  asset,
  quote,
  exchangeRate,
  hasExchangeRate,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  quote: Quote | undefined;
  exchangeRate: number;
  hasExchangeRate: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { currentPriceKRW, purchasePriceKRW, evalAmount, pnl, pnlPct } = getAssetMetrics(
    asset,
    quote,
    exchangeRate,
  );

  return (
    <li className="border-b border-gray-100 px-5 py-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <TickerAvatar asset={asset} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-gray-900">
            {resolveAssetName(asset.ticker, { shortName: quote?.shortName })}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-gray-400">
            <span className="truncate">{asset.ticker}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{asset.category}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum text-[15px] font-bold text-gray-900">
            {evalAmount != null ? `${formatKRW(evalAmount)}원` : '—'}
          </p>
          <p className={`tnum mt-0.5 text-[12px] font-semibold ${pnl != null && pnl >= 0 ? 'text-up' : 'text-down'}`}>
            {pnl != null ? `${formatSigned(pnl)}원 (${pnlPct! >= 0 ? '+' : ''}${pnlPct!.toFixed(2)}%)` : '—'}
          </p>
        </div>
      </div>

      <dl className="mt-3.5 grid grid-cols-3 gap-3 rounded-2xl bg-gray-50 px-4 py-3">
        <div className="min-w-0">
          <dt className="text-[11px] font-medium text-gray-500">현재가</dt>
          <dd className="tnum mt-0.5 text-[13px] font-semibold text-gray-800">
            {currentPriceKRW != null ? formatKRW(currentPriceKRW) : '—'}
            {quote?.changePercent != null && (
              <span className={`ml-1 text-[12px] ${quote.change != null && quote.change >= 0 ? 'text-up' : 'text-down'}`}>
                {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-medium text-gray-500">수량</dt>
          <dd className="tnum mt-0.5 truncate text-[13px] font-semibold text-gray-800">
            {asset.quantity.toLocaleString()}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-medium text-gray-500">매수단가</dt>
          <dd className="tnum mt-0.5 text-[13px] font-semibold text-gray-800">
            <PurchasePrice asset={asset} purchasePriceKRW={purchasePriceKRW} showApprox={hasExchangeRate} />
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onEdit} className="btn btn-secondary h-11 flex-1 text-[14px]">
          수정
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${asset.ticker} 삭제`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-gray-400 transition-colors hover:bg-up-soft hover:text-up"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}

export default function AssetManager({ user }: { user: SessionUser | null }) {
  // 로그인 사용자는 Supabase, 비로그인 사용자는 브라우저에 저장한다. (portfolio-store)
  const userId = user?.id ?? null;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [category, setCategory] = useState<AssetCategory>('미국주식');
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>('KRW');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [sortKey, setSortKey] = useState<SortKey>('category');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [targetAllocations, setTargetAllocations] = useState<Allocations>(defaultAllocations);

  const search = useTickerSearch();
  const allocationSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 최초 로드: 저장소에서 읽고, 로그인했다면 비로그인 때 담아둔 브라우저 데이터를 한 번 옮긴다.
  // 자산이 하나도 없는 첫 방문이면 기본 포트폴리오를 채워 넣는다.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [storedAssets, storedAllocations] = await Promise.all([
          loadAssets(userId),
          loadAllocations(userId),
        ]);
        if (cancelled) return;

        const migrated = userId
          ? await migrateGuestData(userId, storedAssets, storedAllocations)
          : { assets: null, allocations: null };
        if (cancelled) return;

        const loaded = migrated.assets ?? storedAssets;
        setAssets(loaded);

        if (loaded.length === 0) {
          try {
            const seeded = await seedDefaultAssets(userId);
            if (cancelled) return;
            if (seeded) setAssets(seeded);
          } catch (e) {
            if (cancelled) return;
            setSyncError(toMessage(e, '기본 포트폴리오를 만들지 못했습니다.'));
          }
        }

        // 저장된 목표 비중이 하나도 없으면 기본 배분을 보여준다. (값을 건드릴 때 저장된다)
        const allocations = migrated.allocations ?? storedAllocations;
        setTargetAllocations(hasAllocations(allocations) ? allocations : defaultAllocations());
      } catch (e) {
        if (!cancelled) setSyncError(toMessage(e, '데이터를 불러오지 못했습니다.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 목표 비중은 입력할 때마다 저장하면 요청이 과해지므로 잠깐 모았다가 저장한다.
  const scheduleAllocationSave = useCallback(
    (next: Allocations) => {
      if (allocationSaveTimerRef.current) clearTimeout(allocationSaveTimerRef.current);
      allocationSaveTimerRef.current = setTimeout(() => {
        storeAllocations(userId, next).catch((e) =>
          setSyncError(toMessage(e, '목표 비중을 저장하지 못했습니다.')),
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
    setSyncError('');
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

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (!search.ticker) {
      setError(search.query.trim() ? '목록에서 종목을 선택해주세요.' : '종목명을 입력해주세요.');
      return;
    }
    if (!qty || qty <= 0) {
      setError('수량을 올바르게 입력해주세요.');
      return;
    }
    if (!price || price <= 0) {
      setError('매수 단가를 올바르게 입력해주세요.');
      return;
    }

    const newAsset: Asset = {
      id: crypto.randomUUID(),
      ticker: search.ticker,
      category,
      quantity: qty,
      purchasePrice: price,
      purchaseCurrency,
    };

    startTransition(async () => {
      try {
        await saveAsset(userId, newAsset);
      } catch (err) {
        setError(toMessage(err, '자산을 저장하지 못했습니다.'));
        return;
      }
      setSyncError('');
      setAssets((prev) => [...prev, newAsset]);
      search.reset();
      setQuantity('');
      setPurchasePrice('');
      setPurchaseCurrency('KRW');
    });
  }

  async function handleDelete(id: string) {
    const previous = assets;
    setSyncError('');
    setAssets((prev) => prev.filter((a) => a.id !== id));
    try {
      await removeAssetFromStore(userId, id);
    } catch (err) {
      setAssets(previous);
      setSyncError(toMessage(err, '자산을 삭제하지 못했습니다.'));
    }
  }

  async function handleEditSave(updated: Asset) {
    const previous = assets;
    setSyncError('');
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditingAsset(null);

    try {
      await saveAsset(userId, updated);
    } catch (err) {
      setAssets(previous);
      setSyncError(toMessage(err, '자산을 수정하지 못했습니다.'));
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // 환율이 로드된 경우에만 USD 변환 적용 (미로드 시 0이므로 purchasePrice 기준 원화 fallback)
  const rate = exchangeRate > 0 ? exchangeRate : 1;

  const totalEval = assets.reduce((sum, a) => sum + assetValueKRW(a, quotes[a.ticker], rate), 0);

  const totalCost = assets.reduce((sum, a) => {
    return sum + toKRW(a.purchasePrice, a.purchaseCurrency, rate) * a.quantity;
  }, 0);
  const totalPnl = totalEval - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const sortedAssets = [...assets].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (sortKey) {
      case 'ticker':
        aVal = a.ticker;
        bVal = b.ticker;
        break;
      case 'category':
        aVal = CATEGORIES.indexOf(a.category);
        bVal = CATEGORIES.indexOf(b.category);
        break;
      case 'currentPrice': {
        const qa = quotes[a.ticker];
        const qb = quotes[b.ticker];
        aVal = qa?.price != null ? quotePriceToKRW(qa.price, a, rate) : 0;
        bVal = qb?.price != null ? quotePriceToKRW(qb.price, b, rate) : 0;
        break;
      }
      case 'changePercent': {
        const qa = quotes[a.ticker];
        const qb = quotes[b.ticker];
        aVal = qa?.changePercent ?? -Infinity;
        bVal = qb?.changePercent ?? -Infinity;
        break;
      }
      case 'quantity':
        aVal = a.quantity;
        bVal = b.quantity;
        break;
      case 'evalAmount': {
        const qa = quotes[a.ticker];
        const qb = quotes[b.ticker];
        const aPriceKRW = qa?.price != null ? quotePriceToKRW(qa.price, a, rate) : 0;
        const bPriceKRW = qb?.price != null ? quotePriceToKRW(qb.price, b, rate) : 0;
        aVal = aPriceKRW * a.quantity;
        bVal = bPriceKRW * b.quantity;
        break;
      }
      case 'purchasePrice':
        aVal = toKRW(a.purchasePrice, a.purchaseCurrency, rate);
        bVal = toKRW(b.purchasePrice, b.purchaseCurrency, rate);
        break;
      case 'pnl': {
        const qa = quotes[a.ticker];
        const qb = quotes[b.ticker];
        const aPriceKRW = qa?.price != null ? quotePriceToKRW(qa.price, a, rate) : toKRW(a.purchasePrice, a.purchaseCurrency, rate);
        const bPriceKRW = qb?.price != null ? quotePriceToKRW(qb.price, b, rate) : toKRW(b.purchasePrice, b.purchaseCurrency, rate);
        aVal = (aPriceKRW - toKRW(a.purchasePrice, a.purchaseCurrency, rate)) * a.quantity;
        bVal = (bPriceKRW - toKRW(b.purchasePrice, b.purchaseCurrency, rate)) * b.quantity;
        break;
      }
      default:
        return 0;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  // 상단 바는 이미 그릴 수 있으므로 그대로 두고 본문만 스켈레톤으로 채운다.
  if (isLoading) {
    return (
      <>
        <AppHeader user={user} exchangeRate={exchangeRate} active="/" />
        <PortfolioSkeleton />
      </>
    );
  }

  return (
    <>
      <AppHeader user={user} exchangeRate={exchangeRate} active="/" />

      <main className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
        {syncError && (
          <div className="rounded-2xl bg-up-soft px-4 py-3 text-[14px] font-medium text-up">{syncError}</div>
        )}

        {editingAsset && (
          <EditModal
            asset={editingAsset}
            assetName={resolveAssetName(editingAsset.ticker, {
              shortName: quotes[editingAsset.ticker]?.shortName,
            })}
            onSave={handleEditSave}
            onClose={() => setEditingAsset(null)}
          />
        )}

        {/* 총자산 요약 */}
        <section className="card overflow-hidden">
          <div className="p-6">
            <p className="text-[14px] font-medium text-gray-500">총 평가금액</p>
            <p className="tnum mt-1 text-[34px] font-bold leading-tight text-gray-900">
              {totalEval.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="ml-1 text-[22px] font-bold text-gray-700">원</span>
            </p>
            {assets.length > 0 && (
              <p className={`tnum mt-2 text-[15px] font-semibold ${totalPnl >= 0 ? 'text-up' : 'text-down'}`}>
                {totalPnl >= 0 ? '+' : ''}
                {totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
                <span className="ml-1.5">
                  ({totalPnl >= 0 ? '+' : ''}
                  {totalPnlPct.toFixed(2)}%)
                </span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
            <div className="px-6 py-4">
              <p className="text-[13px] text-gray-500">총 매수금액</p>
              <p className="tnum mt-0.5 text-[16px] font-bold text-gray-900">
                {totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
              </p>
            </div>
            <div className="px-6 py-4">
              <p className="text-[13px] text-gray-500">보유 종목</p>
              <p className="tnum mt-0.5 text-[16px] font-bold text-gray-900">{assets.length}개</p>
            </div>
          </div>
        </section>

        {/* 도넛 차트 */}
        {assets.length > 0 && <DonutChart assets={assets} quotes={quotes} exchangeRate={rate} />}

        {/* 목표 비중 */}
        <AllocationTable
          assets={assets}
          quotes={quotes}
          exchangeRate={rate}
          targetAllocations={targetAllocations}
          onChangeTargetAllocations={handleAllocationsChange}
        />

        {/* 자산 목록 */}
        <section>
          <SectionTitle
            action={
              assets.length > 0 ? (
                <div className="lg:hidden">
                  <SortControl
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onChangeKey={handleSort}
                    onToggleDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  />
                </div>
              ) : undefined
            }
          >
            보유 자산
          </SectionTitle>
          {assets.length > 0 ? (
            <>
              {/* 좁은 화면: 카드 목록 */}
              <ul className="card overflow-hidden lg:hidden">
                {sortedAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    quote={quotes[asset.ticker]}
                    exchangeRate={rate}
                    hasExchangeRate={exchangeRate > 0}
                    onEdit={() => setEditingAsset(asset)}
                    onDelete={() => handleDelete(asset.id)}
                  />
                ))}
              </ul>

              {/* 넓은 화면: 표 */}
              <div className="card hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[680px] text-[14px]">
                  <thead className="text-[12px] font-semibold text-gray-500">
                    <tr className="border-b border-gray-100">
                      {TABLE_COLUMNS.map(({ keys, align }) => (
                        <SortHeader
                          key={keys.join('-')}
                          keys={keys}
                          activeKey={sortKey}
                          dir={sortDir}
                          onSort={handleSort}
                          align={align}
                        />
                      ))}
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssets.map((asset) => {
                      const q = quotes[asset.ticker];
                      const { currentPriceKRW, purchasePriceKRW, evalAmount, pnl, pnlPct } =
                        getAssetMetrics(asset, q, rate);

                      return (
                        <tr key={asset.id} className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
                          {/* 종목 · 분류 */}
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <TickerAvatar asset={asset} />
                              <span className="min-w-0">
                                <span className="block max-w-[220px] truncate font-semibold text-gray-900">
                                  {resolveAssetName(asset.ticker, { shortName: q?.shortName })}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-[12px] text-gray-400">
                                  <span className="truncate">{asset.ticker}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="shrink-0">{asset.category}</span>
                                </span>
                              </span>
                            </div>
                          </td>
                          {/* 현재가 · 등락 */}
                          <td className="tnum px-3 py-3.5 text-right text-gray-800">
                            <span className="block">
                              {currentPriceKRW != null ? formatKRW(currentPriceKRW) : '—'}
                            </span>
                            {q?.changePercent != null && (
                              <span
                                className={`block text-[12px] font-semibold ${
                                  q.change != null && q.change >= 0 ? 'text-up' : 'text-down'
                                }`}
                              >
                                {q.changePercent >= 0 ? '+' : ''}
                                {q.changePercent.toFixed(2)}%
                              </span>
                            )}
                          </td>
                          {/* 수량 · 매수단가 */}
                          <td className="tnum px-3 py-3.5 text-right text-gray-800">
                            <span className="block">{asset.quantity.toLocaleString()}</span>
                            <span className="block text-[12px] text-gray-400">
                              <PurchasePrice
                                asset={asset}
                                purchasePriceKRW={purchasePriceKRW}
                                showApprox={exchangeRate > 0}
                                inline
                              />
                            </span>
                          </td>
                          {/* 평가금액 · 평가손익 */}
                          <td className="tnum px-3 py-3.5 text-right">
                            <span className="block font-bold text-gray-900">
                              {evalAmount != null ? `${formatKRW(evalAmount)}원` : '—'}
                            </span>
                            {pnl != null && (
                              <span
                                className={`block text-[12px] font-semibold ${pnl >= 0 ? 'text-up' : 'text-down'}`}
                              >
                                {formatSigned(pnl)}원 ({pnlPct! >= 0 ? '+' : ''}
                                {pnlPct!.toFixed(2)}%)
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-right">
                            <button
                              onClick={() => setEditingAsset(asset)}
                              className="rounded-lg px-2 py-1 text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="ml-0.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-gray-400 transition-colors hover:bg-up-soft hover:text-up"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-[20px]">💼</span>
              <p className="mt-4 text-[15px] font-semibold text-gray-900">아직 등록한 자산이 없어요</p>
              <p className="mt-1 text-[13px] text-gray-500">아래에서 첫 종목을 추가해 보세요.</p>
            </div>
          )}
        </section>

        {/* 자산 등록 폼 */}
        <section>
          <SectionTitle>자산 등록</SectionTitle>
          <div className="card p-6">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">종목명</label>
                  <TickerInput
                    value={search.query}
                    onChange={search.setQuery}
                    suggestions={search.suggestions}
                    showDropdown={search.showDropdown}
                    activeIndex={search.activeIndex}
                    isSearching={search.isSearching}
                    wrapperRef={search.wrapperRef}
                    onKeyDown={(e) => search.handleKeyDown(e)}
                    onSelect={(item) => search.selectSuggestion(item)}
                    onFocus={() => search.suggestions.length > 0 && undefined}
                  />
                </div>
                <div>
                  <label className="label">자산 분류</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AssetCategory)}
                    className="field field-select"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">수량</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="예: 0.001"
                    min="0"
                    step="any"
                    className="field tnum"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="label mb-0">매수 단가</label>
                    <CurrencyToggle value={purchaseCurrency} onChange={setPurchaseCurrency} />
                  </div>
                  {purchaseCurrency === 'USD' ? (
                    <USDInput
                      value={purchasePrice}
                      onChange={setPurchasePrice}
                      placeholder="예: 185.50"
                    />
                  ) : (
                    <input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="예: 28000"
                      min="0"
                      step="any"
                      className="field tnum"
                    />
                  )}
                </div>
              </div>
              {error && <p className="text-[13px] font-medium text-up">{error}</p>}
              <button type="submit" disabled={isPending} className="btn btn-primary btn-lg w-full">
                {isPending ? '등록 중...' : '자산 등록하기'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
