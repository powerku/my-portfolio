'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { signOut } from '@/app/auth/actions';
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
  deleteAsset as deleteAssetRow,
  fetchAllocations,
  fetchAssets,
  saveAllocations,
  upsertAsset,
} from '@/app/lib/portfolio-db';
import { migrateLegacyData } from '@/app/lib/portfolio-migration';

interface Quote {
  ticker: string;
  shortName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface SearchResult {
  ticker: string;
  name: string;
  typeDisp: string;
}

/**
 * 에러를 화면에 띄울 문구로 변환.
 * Supabase의 PostgrestError는 Error 인스턴스가 아니라 `{ message, ... }` 객체다.
 */
function toMessage(e: unknown, fallback: string): string {
  let detail = '';
  if (typeof e === 'string') {
    detail = e;
  } else if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') {
    detail = (e as { message: string }).message;
  }
  return detail ? `${fallback} (${detail})` : fallback;
}

/** 원화로 변환 */
function toKRW(amount: number, currency: Currency, exchangeRate: number): number {
  return currency === 'USD' ? amount * exchangeRate : amount;
}

/** 티커로 Yahoo Finance 시세 통화 판별 (한국 주식 → KRW, 그 외 → USD) */
function getQuoteCurrency(ticker: string): Currency {
  return ticker.endsWith('.KS') || ticker.endsWith('.KQ') ? 'KRW' : 'USD';
}

/** Yahoo Finance 시세 → 원화 변환 (티커 기준 시세 통화 사용) */
function quotePriceToKRW(price: number, asset: Asset, exchangeRate: number): number {
  return getQuoteCurrency(asset.ticker) === 'USD' ? price * exchangeRate : price;
}

/** 원/달러 환율도 시세와 같은 방식으로 조회한다 */
const EXCHANGE_RATE_TICKER = 'USDKRW=X';

/** 여러 티커 시세를 한 번에 조회. 실패하면 빈 결과를 돌려준다. */
async function fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`/api/quote?tickers=${encodeURIComponent(tickers.join(','))}`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    // 시세 조회 실패 시 매수 단가 기준으로 계산되므로 무시한다.
    return {};
  }
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
              ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {c === 'KRW' ? '₩ 원' : '$ 달러'}
        </button>
      ))}
    </div>
  );
}

function useTickerSearch() {
  const [ticker, setTickerState] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function setTicker(value: string) {
    setTickerState(value);
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
    setTickerState(item.ticker);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    onSelect?.(item);
  }

  function reset() {
    setTickerState('');
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  }

  return { ticker, setTicker, suggestions, showDropdown, activeIndex, isSearching, wrapperRef, handleKeyDown, selectSuggestion, reset };
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
        placeholder="종목명 또는 코드 검색"
        autoComplete="off"
        className="field"
      />
      {isSearching && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-medium text-gray-400">
          검색 중
        </span>
      )}
      {showDropdown && (
        <ul className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-white py-1 shadow-pop">
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

function formatKorean(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
  return value.toLocaleString();
}

/** 카테고리별 원화 평가금액 합계 */
function getCategoryTotals(assets: Asset[], quotes: Record<string, Quote>, exchangeRate: number) {
  return CATEGORIES.reduce<Record<AssetCategory, number>>((acc, cat) => {
    acc[cat] = assets
      .filter((a) => a.category === cat)
      .reduce((sum, a) => {
        const q = quotes[a.ticker];
        const priceKRW = q?.price != null
          ? quotePriceToKRW(q.price, a, exchangeRate)
          : toKRW(a.purchasePrice, a.purchaseCurrency, exchangeRate);
        return sum + priceKRW * a.quantity;
      }, 0);
    return acc;
  }, {} as Record<AssetCategory, number>);
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
  onSave,
  onClose,
}: {
  asset: Asset;
  onSave: (updated: Asset) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<AssetCategory>(asset.category);
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>(asset.purchaseCurrency);
  const [quantity, setQuantity] = useState(String(asset.quantity));
  const [purchasePrice, setPurchasePrice] = useState(String(asset.purchasePrice));
  const [error, setError] = useState('');
  const search = useTickerSearch();

  useEffect(() => {
    search.setTicker(asset.ticker);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (!search.ticker.trim()) {
      setError('종목 코드를 입력해주세요.');
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
      ticker: search.ticker.trim().toUpperCase(),
      category,
      quantity: qty,
      purchasePrice: price,
      purchaseCurrency,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/45 backdrop-blur-[2px] sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] bg-white p-6 pb-8 shadow-pop sm:rounded-[24px] sm:pb-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
        <h3 className="mb-5 text-[20px] font-bold text-gray-900">자산 수정</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">종목 코드</label>
            <TickerInput
              value={search.ticker}
              onChange={search.setTicker}
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

function SortHeader({
  label,
  sortKey: key,
  activeKey,
  dir,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`whitespace-nowrap px-3 py-3 ${align === 'left' ? 'text-left' : 'text-right'}`}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`inline-flex items-center transition-colors hover:text-gray-900 ${
          align === 'right' ? 'justify-end' : ''
        } ${activeKey === key ? 'text-gray-900' : ''}`}
      >
        {label}
        <SortIcon active={activeKey === key} dir={dir} />
      </button>
    </th>
  );
}

export default function AssetManager({ userId, userEmail }: { userId: string; userEmail: string }) {
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

  // 최초 로드: Supabase에서 읽고, 남아있는 localStorage 데이터가 있으면 한 번 옮긴다.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [serverAssets, serverAllocations] = await Promise.all([
          fetchAssets(),
          fetchAllocations(),
        ]);
        if (cancelled) return;

        const migrated = await migrateLegacyData(userId, serverAssets, serverAllocations);
        if (cancelled) return;

        setAssets(migrated.assets ?? serverAssets);

        // 저장된 목표 비중이 하나도 없으면 기본 배분을 보여준다. (값을 건드릴 때 저장된다)
        const allocations = migrated.allocations ?? serverAllocations;
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
        saveAllocations(next, userId).catch((e) =>
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

    if (!search.ticker.trim()) {
      setError('종목 코드를 입력해주세요.');
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
      ticker: search.ticker.trim().toUpperCase(),
      category,
      quantity: qty,
      purchasePrice: price,
      purchaseCurrency,
    };

    startTransition(async () => {
      try {
        await upsertAsset(newAsset, userId);
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
      await deleteAssetRow(id);
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
      await upsertAsset(updated, userId);
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

  const totalEval = assets.reduce((sum, a) => {
    const q = quotes[a.ticker];
    const priceKRW = q?.price != null
      ? quotePriceToKRW(q.price, a, rate)
      : toKRW(a.purchasePrice, a.purchaseCurrency, rate);
    return sum + priceKRW * a.quantity;
  }, 0);

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

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-36 animate-pulse rounded-[20px] bg-gray-200" />
        <div className="h-64 animate-pulse rounded-[20px] bg-gray-200" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M4 17V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M10 17V6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M16 17v-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
              </svg>
            </span>
            <span className="text-[17px] font-bold text-gray-900">내 포트폴리오</span>
          </div>

          <div className="flex items-center gap-3">
            {exchangeRate > 0 && (
              <span className="tnum chip hidden bg-gray-100 text-gray-600 sm:inline-flex">
                $1 = {exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 1 })}원
              </span>
            )}
            <span className="hidden max-w-[160px] truncate text-[13px] text-gray-500 md:block">{userEmail}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
        {syncError && (
          <div className="rounded-2xl bg-up-soft px-4 py-3 text-[14px] font-medium text-up">{syncError}</div>
        )}

        {editingAsset && (
          <EditModal
            asset={editingAsset}
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
          <SectionTitle>보유 자산</SectionTitle>
          {assets.length > 0 ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[860px] text-[14px]">
                <thead className="text-[12px] font-semibold text-gray-500">
                  <tr className="border-b border-gray-100">
                    <SortHeader label="종목" sortKey="ticker" activeKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <SortHeader label="분류" sortKey="category" activeKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <SortHeader label="현재가" sortKey="currentPrice" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="등락" sortKey="changePercent" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="수량" sortKey="quantity" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="평가금액" sortKey="evalAmount" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="매수단가" sortKey="purchasePrice" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="평가손익" sortKey="pnl" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sortedAssets.map((asset) => {
                    const q = quotes[asset.ticker];
                    const currentPriceKRW = q?.price != null
                      ? quotePriceToKRW(q.price, asset, rate)
                      : null;
                    const purchasePriceKRW = toKRW(asset.purchasePrice, asset.purchaseCurrency, rate);
                    const pnl = currentPriceKRW != null
                      ? (currentPriceKRW - purchasePriceKRW) * asset.quantity
                      : null;
                    const pnlPct = currentPriceKRW != null
                      ? ((currentPriceKRW - purchasePriceKRW) / purchasePriceKRW) * 100
                      : null;

                    return (
                      <tr key={asset.id} className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ backgroundColor: CATEGORY_COLORS[asset.category] }}
                            >
                              {asset.ticker.slice(0, 2)}
                            </span>
                            <span className="min-w-0">
                              <span className="block max-w-[180px] truncate font-semibold text-gray-900">
                                {q?.shortName ?? asset.ticker}
                              </span>
                              <span className="block text-[12px] text-gray-400">{asset.ticker}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="chip bg-gray-100 text-gray-600">{asset.category}</span>
                        </td>
                        <td className="tnum px-3 py-3.5 text-right text-gray-800">
                          {currentPriceKRW != null
                            ? currentPriceKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })
                            : '—'}
                        </td>
                        <td
                          className={`tnum px-3 py-3.5 text-right font-semibold ${
                            q?.change != null && q.change >= 0 ? 'text-up' : 'text-down'
                          }`}
                        >
                          {q?.changePercent != null
                            ? `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td className="tnum px-3 py-3.5 text-right text-gray-800">{asset.quantity.toLocaleString()}</td>
                        <td className="tnum px-3 py-3.5 text-right font-bold text-gray-900">
                          {currentPriceKRW != null
                            ? `${(currentPriceKRW * asset.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}원`
                            : '—'}
                        </td>
                        <td className="tnum px-3 py-3.5 text-right text-gray-800">
                          {asset.purchaseCurrency === 'USD' ? (
                            <span>
                              <span className="block">
                                ${asset.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                              {exchangeRate > 0 && (
                                <span className="block text-[12px] text-gray-400">
                                  ≈ {purchasePriceKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
                                </span>
                              )}
                            </span>
                          ) : (
                            `${asset.purchasePrice.toLocaleString()}원`
                          )}
                        </td>
                        <td
                          className={`tnum px-3 py-3.5 text-right font-semibold ${
                            pnl != null && pnl >= 0 ? 'text-up' : 'text-down'
                          }`}
                        >
                          {pnl != null ? (
                            <>
                              <span className="block">
                                {pnl >= 0 ? '+' : ''}
                                {pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
                              </span>
                              <span className="block text-[12px] font-medium opacity-80">
                                {pnlPct! >= 0 ? '+' : ''}
                                {pnlPct!.toFixed(2)}%
                              </span>
                            </>
                          ) : (
                            '—'
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
                  <label className="label">종목 코드</label>
                  <TickerInput
                    value={search.ticker}
                    onChange={search.setTicker}
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
