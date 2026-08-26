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
  emptyAllocations,
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

/** 통화 선택 토글 버튼 */
function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="flex rounded border overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => onChange('KRW')}
        className={`px-2 py-0.5 transition-colors ${
          value === 'KRW' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        ₩ 원
      </button>
      <button
        type="button"
        onClick={() => onChange('USD')}
        className={`px-2 py-0.5 border-l transition-colors ${
          value === 'USD' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        $ 달러
      </button>
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
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {isSearching && (
        <span className="absolute right-3 top-2.5 text-gray-400 text-xs">검색 중...</span>
      )}
      {showDropdown && (
        <ul className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
          {suggestions.map((item, idx) => (
            <li
              key={item.ticker}
              onMouseDown={() => onSelect(item)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
                idx === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <span>
                <span className="font-medium">{item.ticker}</span>
                <span className="text-gray-500 ml-2">{item.name}</span>
              </span>
              {item.typeDisp && (
                <span className="text-xs text-gray-400 ml-2 shrink-0">{item.typeDisp}</span>
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min="0"
        step="any"
        className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

function DonutChart({
  assets,
  quotes,
  exchangeRate,
}: {
  assets: Asset[];
  quotes: Record<string, Quote>;
  exchangeRate: number;
}) {
  const categoryTotals = CATEGORIES.reduce<Record<AssetCategory, number>>((acc, cat) => {
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

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const activeCategories = CATEGORIES.filter((c) => categoryTotals[c] > 0);

  const cx = 100, cy = 100, outerR = 80, innerR = 52;
  let currentAngle = 0;

  const segments = activeCategories.map((cat) => {
    const sweepAngle = (categoryTotals[cat] / total) * 360;
    const path = arcPath(cx, cy, outerR, innerR, currentAngle, currentAngle + sweepAngle);
    currentAngle += sweepAngle;
    return { cat, path };
  });

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">자산 분류</h2>
      <div className="rounded-lg border p-4 flex flex-col sm:flex-row items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0">
          {segments.map(({ cat, path }) => (
            <path key={cat} d={path} fill={CATEGORY_COLORS[cat]} />
          ))}
          <text x="100" y="94" textAnchor="middle" fontSize="10" fill="#9CA3AF">총 평가금액</text>
          <text x="100" y="112" textAnchor="middle" fontSize="13" fill="#111827" fontWeight="700">
            {formatKorean(total)}원
          </text>
        </svg>
        <div className="flex flex-col gap-2 text-sm w-full">
          {activeCategories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
              <span className="flex-1 text-gray-700">{cat}</span>
              <span className="text-gray-400 w-12 text-right">
                {Math.round((categoryTotals[cat] / total) * 100)}%
              </span>
              <span className="text-gray-800 font-medium w-32 text-right">
                {Math.round(categoryTotals[cat]).toLocaleString()} 원
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">자산 수정</h3>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">종목 코드</label>
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
            <label className="block text-sm text-gray-600 mb-1">자산 분류</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">수량</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="예: 0.001"
                min="0"
                step="any"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-600">매수 단가</label>
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
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              저장
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              취소
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
  const categoryTotals = CATEGORIES.reduce<Record<AssetCategory, number>>((acc, cat) => {
    acc[cat] = assets
      .filter((a) => a.category === cat)
      .reduce((sum, a) => {
        const q = quotes[a.ticker];
        const priceKRW =
          q?.price != null
            ? quotePriceToKRW(q.price, a, exchangeRate)
            : toKRW(a.purchasePrice, a.purchaseCurrency, exchangeRate);
        return sum + priceKRW * a.quantity;
      }, 0);
    return acc;
  }, {} as Record<AssetCategory, number>);

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  const targetSum = CATEGORIES.reduce((s, c) => s + (Number(targetAllocations[c]) || 0), 0);

  function handleChange(cat: AssetCategory, val: string) {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    onChangeTargetAllocations({ ...targetAllocations, [cat]: num });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">목표 비중</h2>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">분류</th>
              <th className="text-right p-3">목표 비중</th>
              <th className="text-right p-3">현재 비중</th>
              <th className="text-right p-3">차이</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {CATEGORIES.map((cat) => {
              const currentPct = total > 0 ? (categoryTotals[cat] / total) * 100 : 0;
              const target = Number(targetAllocations[cat]) || 0;
              const diff = currentPct - target;
              const absDiff = Math.abs(diff);
              const isAlert = target > 0 && absDiff >= 5;
              const diffColor = isAlert
                ? (diff > 0 ? 'text-red-500' : 'text-blue-500')
                : 'text-gray-600';
              const diffAmount = total > 0 ? (diff / 100) * total : 0;

              return (
                <tr key={cat} className="hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                      <span>{cat}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        value={targetAllocations[cat] === 0 ? '' : targetAllocations[cat]}
                        onChange={(e) => handleChange(cat, e.target.value)}
                        min="0"
                        max="100"
                        step="1"
                        placeholder="0"
                        className="w-16 border rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-700">
                    {total > 0 ? `${currentPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className={`p-3 text-right font-medium ${diffColor}`}>
                    {target > 0 && total > 0 ? (
                      <>
                        <span>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}%</span>
                        <span className="block text-xs font-normal">
                          {diffAmount >= 0 ? '+' : ''}{formatKorean(Math.round(diffAmount))}원
                        </span>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr>
              <td className="p-3 font-medium text-gray-700">합계</td>
              <td className={`p-3 text-right font-medium ${targetSum > 0 && Math.abs(targetSum - 100) > 0.01 ? 'text-amber-500' : 'text-gray-700'}`}>
                {targetSum > 0 ? `${targetSum.toFixed(1)}%` : '—'}
              </td>
              <td className="p-3 text-right font-medium text-gray-700">
                {total > 0 ? '100.0%' : '—'}
              </td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
        {targetSum > 0 && Math.abs(targetSum - 100) > 0.01 && (
          <div className="px-3 py-2 bg-amber-50 border-t text-amber-600 text-xs">
            목표 비중 합계가 100%가 아닙니다 (현재 {targetSum.toFixed(1)}%)
          </div>
        )}
      </div>
    </div>
  );
}

type SortKey = 'ticker' | 'category' | 'currentPrice' | 'changePercent' | 'quantity' | 'evalAmount' | 'purchasePrice' | 'pnl';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block text-xs ${active ? 'text-blue-500' : 'text-gray-300'}`}>
      {active && dir === 'desc' ? '▼' : '▲'}
    </span>
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
  const [targetAllocations, setTargetAllocations] = useState<Allocations>(emptyAllocations);

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
        setTargetAllocations(migrated.allocations ?? serverAllocations);
      } catch (e) {
        if (!cancelled) setSyncError(toMessage(e, '데이터를 불러오지 못했습니다.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    fetchExchangeRate();
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

  useEffect(() => {
    if (assets.length === 0) return;
    const tickers = [...new Set(assets.map((a) => a.ticker))];
    tickers.forEach(fetchQuote);
  }, [assets]);

  async function fetchExchangeRate() {
    try {
      const res = await fetch(`/api/quote?ticker=${encodeURIComponent('USDKRW=X')}`);
      const data: Quote = await res.json();
      if (res.ok && data.price != null && data.price > 0) {
        setExchangeRate(data.price);
      }
    } catch {
      // 환율 조회 실패 시 무시
    }
  }

  async function fetchQuote(t: string) {
    try {
      const res = await fetch(`/api/quote?ticker=${encodeURIComponent(t)}`);
      const data: Quote = await res.json();
      if (res.ok) {
        setQuotes((prev) => ({ ...prev, [t]: data }));
      }
    } catch {
      // 시세 조회 실패 시 무시
    }
  }

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
      fetchQuote(newAsset.ticker);
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
    const previousTicker = editingAsset?.ticker;
    setSyncError('');
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditingAsset(null);

    try {
      await upsertAsset(updated, userId);
      if (updated.ticker !== previousTicker) fetchQuote(updated.ticker);
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
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-400 text-sm text-center py-16">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">내 포트폴리오</h1>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="truncate max-w-[180px]">{userEmail}</span>
            <form action={signOut}>
              <button type="submit" className="hover:text-gray-700 underline underline-offset-2">
                로그아웃
              </button>
            </form>
          </div>
          {exchangeRate > 0 && (
            <span className="text-xs text-gray-400">
              환율 {exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 1 })}원/$
            </span>
          )}
        </div>
      </div>

      {syncError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {syncError}
        </div>
      )}

      {editingAsset && (
        <EditModal
          asset={editingAsset}
          onSave={handleEditSave}
          onClose={() => setEditingAsset(null)}
        />
      )}

      {/* 요약 카드 */}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">총 평가금액</p>
            <p className="text-lg font-semibold">{totalEval.toLocaleString(undefined, { maximumFractionDigits: 0 })} 원</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">총 매수금액</p>
            <p className="text-lg font-semibold">{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} 원</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">평가손익</p>
            <p className={`text-lg font-semibold ${totalPnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} 원
              <span className="text-sm ml-1">({totalPnlPct.toFixed(2)}%)</span>
            </p>
          </div>
        </div>
      )}

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
      {assets.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">보유 자산</h2>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3">
                    <button type="button" onClick={() => handleSort('ticker')} className="flex items-center hover:text-gray-900">
                      종목<SortIcon active={sortKey === 'ticker'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button type="button" onClick={() => handleSort('category')} className="flex items-center hover:text-gray-900">
                      분류<SortIcon active={sortKey === 'category'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-right p-3">
                    <button type="button" onClick={() => handleSort('currentPrice')} className="flex items-center justify-end w-full hover:text-gray-900">
                      현재가 (원)<SortIcon active={sortKey === 'currentPrice'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-right p-3">
                    <button type="button" onClick={() => handleSort('changePercent')} className="flex items-center justify-end w-full hover:text-gray-900">
                      등락<SortIcon active={sortKey === 'changePercent'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-right p-3">
                    <button type="button" onClick={() => handleSort('quantity')} className="flex items-center justify-end w-full hover:text-gray-900">
                      수량<SortIcon active={sortKey === 'quantity'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-right p-3">
                    <button type="button" onClick={() => handleSort('evalAmount')} className="flex items-center justify-end w-full hover:text-gray-900">
                      평가 금액<SortIcon active={sortKey === 'evalAmount'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-right p-3">
                    <button type="button" onClick={() => handleSort('purchasePrice')} className="flex items-center justify-end w-full hover:text-gray-900">
                      매수단가<SortIcon active={sortKey === 'purchasePrice'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-right p-3">
                    <button type="button" onClick={() => handleSort('pnl')} className="flex items-center justify-end w-full hover:text-gray-900">
                      평가손익<SortIcon active={sortKey === 'pnl'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
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
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium">{q?.shortName ?? asset.ticker}</p>
                        <p className="text-xs text-gray-400">{asset.ticker}</p>
                      </td>
                      <td className="p-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {asset.category}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {currentPriceKRW != null
                          ? currentPriceKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })
                          : '—'}
                      </td>
                      <td className={`p-3 text-right ${q?.change != null && q.change >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {q?.changePercent != null
                          ? `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="p-3 text-right">{asset.quantity.toLocaleString()}</td>
                      <td className="p-3 text-right font-medium">
                        {currentPriceKRW != null
                          ? `${(currentPriceKRW * asset.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}원`
                          : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {asset.purchaseCurrency === 'USD' ? (
                          <span>
                            <span className="text-gray-500 text-xs">${asset.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            {exchangeRate > 0 && (
                              <span className="block text-gray-400 text-xs">
                                ≈ {purchasePriceKRW.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
                              </span>
                            )}
                          </span>
                        ) : (
                          `${asset.purchasePrice.toLocaleString()}원`
                        )}
                      </td>
                      <td className={`p-3 text-right ${pnl != null && pnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {pnl != null
                          ? `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}원 (${pnlPct!.toFixed(2)}%)`
                          : '—'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setEditingAsset(asset)}
                          className="text-gray-400 hover:text-blue-500 text-xs px-2 py-1 rounded mr-1"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 rounded"
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
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-8">등록된 자산이 없습니다.</p>
      )}

      {/* 자산 등록 폼 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">자산 등록</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">종목 코드</label>
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
              <label className="block text-sm text-gray-600 mb-1">자산 분류</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">수량</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="예: 0.001"
                min="0"
                step="any"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-600">매수 단가</label>
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
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '등록 중...' : '자산 등록'}
          </button>
        </form>
      </div>
    </div>
  );
}
