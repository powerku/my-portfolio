'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/app/components/AppHeader';
import { type Asset, CATEGORY_COLORS } from '@/app/lib/portfolio';
import { type SessionUser, loadAssets } from '@/app/lib/portfolio-store';
import { resolveAssetName } from '@/app/lib/kr-assets';
import {
  type DividendInfo,
  dDayLabel,
  daysUntil,
  formatExDate,
  formatPerShare,
  frequencyLabel,
  todayKey,
} from '@/app/lib/dividend';
import {
  type Quote,
  EXCHANGE_RATE_TICKER,
  assetValueKRW,
  fetchQuotes,
  formatKRW,
  formatKorean,
  toMessage,
} from '@/app/lib/quotes';

/** 배당 정보를 한 번에 조회. 실패하면 빈 결과를 돌려준다. */
async function fetchDividends(tickers: string[]): Promise<Record<string, DividendInfo>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`/api/dividend?tickers=${encodeURIComponent(tickers.join(','))}`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * 배당금(표시 통화) → 원화.
 *
 * 배당 통화는 Yahoo가 준 값을 그대로 쓰기 때문에 원/달러 말고도 올 수 있다.
 * 환산할 수 없으면 null을 돌려주고, 합계에서는 빼고 화면에는 '—'로 표시한다.
 */
function dividendToKRW(amount: number, currency: string, exchangeRate: number): number | null {
  if (currency === 'KRW') return amount;
  if (currency === 'USD') return exchangeRate > 0 ? amount * exchangeRate : null;
  return null;
}

/** 한 종목의 배당 현황. 배당 정보를 아직 못 받았거나 무배당이면 금액이 0/null이다. */
interface DividendRow {
  asset: Asset;
  name: string;
  info: DividendInfo | undefined;
  /** 시가 배당률(%). 시세를 못 받으면 null */
  yieldPct: number | null;
  /** 보유분 연간 배당금(원). 환산할 수 없으면 null */
  annualKRW: number | null;
  /** 월별(1~12월) 보유분 배당금(원) */
  monthlyKRW: number[];
}

function buildRow(
  asset: Asset,
  info: DividendInfo | undefined,
  quote: Quote | undefined,
  exchangeRate: number,
): DividendRow {
  const name = resolveAssetName(asset.ticker, { shortName: quote?.shortName });
  const annualPerShare = info?.annualPerShare ?? 0;

  return {
    asset,
    name,
    info,
    // 시가 배당률 = 주당 연간 배당금 / 현재가. 둘 다 시세 통화라 환율이 필요 없다.
    yieldPct:
      info && quote?.price != null && quote.price > 0 ? (annualPerShare / quote.price) * 100 : null,
    annualKRW: info ? dividendToKRW(annualPerShare * asset.quantity, info.currency, exchangeRate) : null,
    // 월별 합계를 더할 때 자리가 비지 않도록 항상 12칸을 만든다.
    monthlyKRW: Array.from({ length: 12 }, (_, month) => {
      const perShare = info?.monthlyPerShare?.[month] ?? 0;
      return (info ? dividendToKRW(perShare * asset.quantity, info.currency, exchangeRate) : null) ?? 0;
    }),
  };
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold text-gray-900">{children}</h2>
      {action}
    </div>
  );
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

/** 배당 주기 배지. 무배당은 눌린 색으로 구분한다. */
function FrequencyChip({ paymentsPerYear }: { paymentsPerYear: number | undefined }) {
  if (paymentsPerYear == null) return <span className="text-gray-300">—</span>;
  return (
    <span
      className={`chip ${paymentsPerYear > 0 ? 'bg-brand-soft text-brand' : 'bg-gray-100 text-gray-400'}`}
    >
      {frequencyLabel(paymentsPerYear)}
    </span>
  );
}

/** 주당 배당금 + 그 배당의 배당락일 */
function PerShare({ info }: { info: DividendInfo | undefined }) {
  if (!info || info.lastPerShare == null) return <span className="text-gray-300">—</span>;
  return (
    <>
      <span className="block">{formatPerShare(info.lastPerShare, info.currency)}</span>
      {info.lastExDate && (
        <span className="block text-[12px] font-normal text-gray-400">
          {formatExDate(info.lastExDate)} 기준
        </span>
      )}
    </>
  );
}

/**
 * 다음 배당락일.
 *
 * 확정 일정이면 배당금이 실제로 들어오는 지급일을 함께 보여주고, 확정 일자가 없으면
 * 배당 주기로 추정한 값임을 알린다.
 */
function NextExDate({ info }: { info: DividendInfo | undefined }) {
  if (!info?.nextExDate) return <span className="text-gray-300">—</span>;
  return (
    <>
      <span className="block">{formatExDate(info.nextExDate, { withYear: true })}</span>
      {info.nextExDateEstimated ? (
        <span className="block text-[12px] font-normal text-gray-400">예상</span>
      ) : (
        info.nextPayDate && (
          <span className="block text-[12px] font-normal text-gray-400">
            {formatExDate(info.nextPayDate)} 지급
          </span>
        )
      )}
    </>
  );
}

/** 연간 배당금(보유분) + 월 평균 */
function AnnualAmount({ annualKRW }: { annualKRW: number | null }) {
  if (annualKRW == null) return <span className="text-gray-300">—</span>;
  return (
    <>
      <span className="block">{formatKRW(annualKRW)}원</span>
      <span className="block text-[12px] font-normal text-gray-400">
        월 {formatKRW(annualKRW / 12)}원
      </span>
    </>
  );
}

/** 배당락일이 이만큼 안에 남았으면 곧 들어오는 배당으로 강조한다. */
const IMMINENT_DAYS = 7;

/** 접어둔 상태에서 보여줄 일정 수 */
const UPCOMING_PREVIEW = 5;

/** 다가오는 배당 한 건. 같은 티커를 여러 번 담았어도 한 건으로 합친다. */
interface UpcomingDividend {
  ticker: string;
  name: string;
  /** 배당락일 (YYYY-MM-DD) */
  exDate: string;
  /** 배당락일이 배당 주기로 추정한 값인지 */
  estimated: boolean;
  /** 배당금이 들어오는 날 (YYYY-MM-DD). 확정 일정이 없으면 null */
  payDate: string | null;
  /** 이번 한 번의 배당으로 받을 금액(원). 환산할 수 없으면 null */
  amountKRW: number | null;
  /** 배당락일까지 남은 날수 */
  days: number;
}

/**
 * 배당락일 순으로 정렬한 다가오는 배당 목록.
 *
 * 이번에 받을 금액은 가장 최근에 지급한 1회분을 그대로 쓴다. 연간 배당금을 횟수로
 * 나누면 배당을 늘린 종목이 실제보다 적게 나온다.
 */
function upcomingDividends(rows: DividendRow[], exchangeRate: number, today: string): UpcomingDividend[] {
  const byTicker = new Map<string, UpcomingDividend>();

  for (const { asset, name, info } of rows) {
    if (!info?.nextExDate) continue;
    const amount =
      info.lastPerShare != null
        ? dividendToKRW(info.lastPerShare * asset.quantity, info.currency, exchangeRate)
        : null;

    const found = byTicker.get(asset.ticker);
    if (found) {
      // 한 종목이라도 환산할 수 없는 몫이 있으면 합계를 믿을 수 없다.
      found.amountKRW = found.amountKRW != null && amount != null ? found.amountKRW + amount : null;
      continue;
    }

    byTicker.set(asset.ticker, {
      ticker: asset.ticker,
      name,
      exDate: info.nextExDate,
      estimated: info.nextExDateEstimated,
      payDate: info.nextPayDate,
      amountKRW: amount,
      days: daysUntil(info.nextExDate, today),
    });
  }

  return [...byTicker.values()].sort((a, b) => a.exDate.localeCompare(b.exDate));
}

/**
 * 남은 날수 배지. 배당락일이 가까운 종목만 눈에 띄게 한다.
 *
 * 배당 정보는 몇 시간 동안 재사용하므로 확정 배당락일이 그새 지나갈 수 있다.
 * 이미 지난 날짜는 강조하지 않는다.
 */
function DDayChip({ days }: { days: number }) {
  const tone =
    days < 0 ? 'bg-gray-100 text-gray-400' : days <= IMMINENT_DAYS ? 'bg-brand text-white' : 'bg-brand-soft text-brand';
  return <span className={`chip w-[52px] justify-center ${tone}`}>{dDayLabel(days)}</span>;
}

/** 다가오는 배당 한 줄. 배당락일과 그 배당이 들어오는 날을 함께 보여준다. */
function UpcomingRow({ item, withYear }: { item: UpcomingDividend; withYear: boolean }) {
  return (
    <li className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 last:border-b-0">
      <DDayChip days={item.days} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-gray-900">{item.name}</p>
        <p className="mt-0.5 truncate text-[12px] text-gray-500">
          {formatExDate(item.exDate, { withYear })} 배당락
          {item.estimated && <span className="text-gray-400"> (예상)</span>}
          {item.payDate && (
            <>
              <span aria-hidden="true" className="text-gray-300"> · </span>
              {formatExDate(item.payDate)} 입금
            </>
          )}
        </p>
      </div>
      <p className="tnum shrink-0 text-[14px] font-bold text-gray-900">
        {item.amountKRW != null ? `${formatKRW(Math.round(item.amountKRW))}원` : '—'}
      </p>
    </li>
  );
}

/**
 * 배당락일 순으로 늘어놓은 다가오는 배당 일정.
 *
 * 종목별 표는 금액이 큰 순서라 언제 들어오는지 읽기 어려워, 날짜 순 목록을 따로 둔다.
 */
function UpcomingDividends({ items, today }: { items: UpcomingDividend[]; today: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (items.length === 0) return null;

  /** 해가 바뀐 뒤의 배당락일은 연도를 붙여야 몇 월인지 헷갈리지 않는다. */
  const currentYear = today.slice(0, 4);

  const hidden = items.length - UPCOMING_PREVIEW;
  const visible = isExpanded ? items : items.slice(0, UPCOMING_PREVIEW);

  return (
    <section>
      <SectionTitle
        action={
          <span className="text-[12px] text-gray-400">배당락일 전날까지 보유해야 받아요</span>
        }
      >
        다가오는 배당
      </SectionTitle>
      <div className="card overflow-hidden">
        <ul>
          {visible.map((item) => (
            <UpcomingRow key={item.ticker} item={item} withYear={item.exDate.slice(0, 4) !== currentYear} />
          ))}
        </ul>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="w-full border-t border-gray-100 py-3 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-gray-50"
          >
            {isExpanded ? '접기' : `${hidden}개 더 보기`}
          </button>
        )}
      </div>
    </section>
  );
}

/** 한 달에 들어올 배당을 종목별로 쪼갠 목록. 같은 티커를 여러 번 담았으면 합쳐서 한 줄로 본다. */
function monthlyBreakdown(rows: DividendRow[], month: number) {
  const byTicker = new Map<string, { ticker: string; name: string; amount: number }>();

  for (const row of rows) {
    const amount = row.monthlyKRW[month - 1];
    if (amount <= 0) continue;
    const found = byTicker.get(row.asset.ticker);
    if (found) found.amount += amount;
    else byTicker.set(row.asset.ticker, { ticker: row.asset.ticker, name: row.name, amount });
  }

  return [...byTicker.values()].sort((a, b) => b.amount - a.amount);
}

/**
 * 말풍선을 붙일 가로 위치.
 *
 * 가운데 달은 막대 중심에 맞추고, 양 끝 달은 카드 밖으로 삐져나가지 않게 카드 모서리에 붙인다.
 */
function tooltipPosition(month: number): React.CSSProperties {
  if (month <= 3) return { left: 0 };
  if (month >= 10) return { right: 0 };
  return { left: `${((month - 0.5) / 12) * 100}%`, transform: 'translateX(-50%)' };
}

/** 막대를 가리켰을 때 뜨는 그 달의 배당 상세 */
function MonthlyTooltip({ month, rows }: { month: number; rows: DividendRow[] }) {
  const items = monthlyBreakdown(rows, month);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="rounded-2xl bg-gray-900/95 px-3.5 py-3 shadow-pop">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold text-gray-300">{month}월</span>
        <span className="tnum text-[13px] font-bold text-white">
          {formatKRW(Math.round(total))}원
        </span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-gray-400">예상 배당 없음</p>
      ) : (
        <ul className="mt-2 space-y-1 border-t border-white/15 pt-2">
          {items.map((item) => (
            <li key={item.ticker} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate text-gray-200">{item.name}</span>
              <span className="tnum shrink-0 font-semibold text-white">
                {formatKRW(Math.round(item.amount))}원
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 최근 1년 실적을 달마다 모아 보여주는 막대그래프 */
function MonthlyChart({
  rows,
  monthlyKRW,
  currentMonth,
}: {
  rows: DividendRow[];
  monthlyKRW: number[];
  currentMonth: number;
}) {
  // 마우스는 올리면, 손가락은 누르면 열린다. 열린 달의 상세를 말풍선으로 보여준다.
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const max = Math.max(...monthlyKRW);
  if (max <= 0) return null;

  /** 다른 막대로 옮겨간 뒤 늦게 도착한 leave/blur가 새 말풍선을 닫지 않도록 확인한다. */
  const closeIfActive = (month: number) =>
    setActiveMonth((prev) => (prev === month ? null : prev));

  return (
    <section>
      <SectionTitle>월별 배당</SectionTitle>
      <div className="card px-4 py-6 sm:px-6">
        <div className="relative" onPointerLeave={() => setActiveMonth(null)}>
          <div className="flex items-end gap-1 sm:gap-2">
            {monthlyKRW.map((amount, index) => {
              const month = index + 1;
              const isCurrent = month === currentMonth;
              const isActive = month === activeMonth;

              return (
                <div key={month} className="min-w-0 flex-1">
                  <p className="tnum hidden h-4 text-center text-[10px] font-semibold text-gray-500 sm:block">
                    {amount > 0 ? formatKorean(Math.round(amount)) : ''}
                  </p>
                  <button
                    type="button"
                    aria-label={`${month}월 ${formatKRW(Math.round(amount))}원`}
                    aria-expanded={isActive}
                    // 터치는 pointerenter도 먼저 보내기 때문에, 마우스일 때만 올려서 연다.
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setActiveMonth(month)}
                    onPointerLeave={(e) => e.pointerType === 'mouse' && closeIfActive(month)}
                    onFocus={() => setActiveMonth(month)}
                    onBlur={() => closeIfActive(month)}
                    onClick={() => setActiveMonth((prev) => (prev === month ? null : month))}
                    className="flex h-32 w-full items-end"
                  >
                    <span
                      className={`w-full rounded-t-[5px] transition-[height] duration-300 ${
                        amount > 0
                          ? isCurrent || isActive
                            ? 'bg-brand'
                            : 'bg-brand/35'
                          : 'bg-gray-100'
                      }`}
                      // 금액이 아주 적은 달도 막대가 보이도록 최소 높이를 준다.
                      style={{ height: amount > 0 ? `max(${(amount / max) * 100}%, 4px)` : '3px' }}
                    />
                  </button>
                  <p
                    className={`mt-2 text-center text-[11px] ${
                      isCurrent ? 'font-bold text-brand' : 'text-gray-400'
                    }`}
                  >
                    {month}
                  </p>
                </div>
              );
            })}
          </div>

          {activeMonth != null && (
            <div
              role="tooltip"
              // 막대를 가리지 않도록 그래프 위쪽에 띄우고, 클릭은 막대로 그대로 가게 둔다.
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-44"
              style={tooltipPosition(activeMonth)}
            >
              <MonthlyTooltip month={activeMonth} rows={rows} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** 표가 들어가지 않는 좁은 화면용 종목 카드 */
function DividendCard({ row }: { row: DividendRow }) {
  const { asset, name, info, yieldPct, annualKRW } = row;

  return (
    <li className="border-b border-gray-100 px-5 py-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <TickerAvatar asset={asset} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-gray-900">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-gray-400">
            <span className="truncate">{asset.ticker}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{asset.quantity.toLocaleString()}주</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum text-[15px] font-bold text-gray-900">
            {annualKRW != null ? `${formatKRW(annualKRW)}원` : '—'}
          </p>
          <p className="tnum mt-0.5 text-[12px] text-gray-500">
            {annualKRW != null ? `월 ${formatKRW(annualKRW / 12)}원` : '연간 배당금'}
          </p>
        </div>
      </div>

      <dl className="mt-3.5 grid grid-cols-3 gap-3 rounded-2xl bg-gray-50 px-4 py-3">
        <div className="min-w-0">
          <dt className="text-[11px] font-medium text-gray-500">주당 배당금</dt>
          <dd className="tnum mt-0.5 text-[13px] font-semibold text-gray-800">
            <PerShare info={info} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-medium text-gray-500">시가 배당률</dt>
          <dd className="tnum mt-0.5 text-[13px] font-semibold text-gray-800">
            {yieldPct != null ? `${yieldPct.toFixed(2)}%` : '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-medium text-gray-500">다음 배당락일</dt>
          <dd className="tnum mt-0.5 text-[13px] font-semibold text-gray-800">
            <NextExDate info={info} />
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <FrequencyChip paymentsPerYear={info?.paymentsPerYear} />
      </div>
    </li>
  );
}

/** 표 열 정의. 좁은 화면 카드와 같은 값을 보여준다. */
const COLUMNS: { label: string; align: 'left' | 'right' }[] = [
  { label: '종목', align: 'left' },
  { label: '주당 배당금', align: 'right' },
  { label: '배당 주기', align: 'left' },
  { label: '시가 배당률', align: 'right' },
  { label: '다음 배당락일', align: 'right' },
  { label: '연간 배당금', align: 'right' },
];

export default function DividendManager({ user }: { user: SessionUser | null }) {
  // 로그인 사용자는 Supabase, 비로그인 사용자는 브라우저에서 읽는다. (portfolio-store)
  const userId = user?.id ?? null;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [dividends, setDividends] = useState<Record<string, DividendInfo>>({});
  const [exchangeRate, setExchangeRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  /** 배당 정보를 받아둔 티커 목록. 보유 종목과 다르면 아직 불러오는 중이다. */
  const [loadedTickerKey, setLoadedTickerKey] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await loadAssets(userId);
        if (!cancelled) setAssets(stored);
      } catch (e) {
        if (!cancelled) setSyncError(toMessage(e, '보유 자산을 불러오지 못했습니다.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 보유 티커 목록. 구성이 바뀔 때만 다시 불러오도록 문자열로 만든다.
  const tickerKey = [...new Set(assets.map((a) => a.ticker))].sort().join(',');

  // 시세·환율과 배당 정보를 함께 불러온다. 배당 정보가 느려도 시세는 먼저 반영된다.
  useEffect(() => {
    if (isLoading || !tickerKey) return;

    let cancelled = false;
    const tickers = tickerKey.split(',');

    fetchQuotes([EXCHANGE_RATE_TICKER, ...tickers]).then((result) => {
      if (cancelled) return;
      const rate = result[EXCHANGE_RATE_TICKER];
      if (rate?.price != null && rate.price > 0) setExchangeRate(rate.price);
      setQuotes((prev) => ({ ...prev, ...result }));
    });

    fetchDividends(tickers).then((result) => {
      if (cancelled) return;
      setDividends((prev) => ({ ...prev, ...result }));
      setLoadedTickerKey(tickerKey);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, tickerKey]);

  const rows = assets
    .map((asset) => buildRow(asset, dividends[asset.ticker], quotes[asset.ticker], exchangeRate))
    .sort((a, b) => (b.annualKRW ?? 0) - (a.annualKRW ?? 0));

  const annualTotal = rows.reduce((sum, row) => sum + (row.annualKRW ?? 0), 0);
  const monthlyTotals = rows.reduce(
    (totals, row) => totals.map((amount, month) => amount + row.monthlyKRW[month]),
    Array<number>(12).fill(0),
  );

  const isFetchingDividends = tickerKey !== '' && loadedTickerKey !== tickerKey;
  const today = todayKey();
  const currentMonth = Number(today.slice(5, 7));
  const upcoming = upcomingDividends(rows, exchangeRate, today);
  const totalEval = assets.reduce(
    (sum, asset) => sum + assetValueKRW(asset, quotes[asset.ticker], exchangeRate > 0 ? exchangeRate : 1),
    0,
  );
  const portfolioYield = totalEval > 0 ? (annualTotal / totalEval) * 100 : null;
  const payingCount = rows.filter((row) => (row.info?.paymentsPerYear ?? 0) > 0).length;

  if (isLoading) {
    return (
      <>
        <AppHeader user={user} exchangeRate={exchangeRate} active="/dividend" />
        <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-8">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-36 animate-pulse rounded-[20px] bg-gray-200" />
          <div className="h-64 animate-pulse rounded-[20px] bg-gray-200" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader user={user} exchangeRate={exchangeRate} active="/dividend" />

      <main className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
        {syncError && (
          <div className="rounded-2xl bg-up-soft px-4 py-3 text-[14px] font-medium text-up">{syncError}</div>
        )}

        {assets.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-[20px]">💸</span>
            <p className="mt-4 text-[15px] font-semibold text-gray-900">아직 등록한 자산이 없어요</p>
            <p className="mt-1 text-[13px] text-gray-500">자산을 등록하면 받을 배당금을 계산해 드려요.</p>
            <Link href="/" className="btn btn-primary btn-md mt-5 px-6">
              자산 등록하러 가기
            </Link>
          </div>
        ) : (
          <>
            {/* 배당 요약 */}
            <section className="card overflow-hidden">
              <div className="p-6">
                <p className="text-[14px] font-medium text-gray-500">연간 예상 배당금</p>
                <p className="tnum mt-1 text-[34px] font-bold leading-tight text-gray-900">
                  {formatKRW(annualTotal)}
                  <span className="ml-1 text-[22px] font-bold text-gray-700">원</span>
                </p>
                <p className="tnum mt-2 text-[15px] font-semibold text-gray-500">
                  월 평균 {formatKRW(annualTotal / 12)}원
                </p>
                {/* 가장 가까운 배당은 스크롤하지 않고도 보이도록 요약에 함께 둔다. */}
                {upcoming[0] && (
                  <p className="mt-3.5 inline-flex flex-wrap items-center gap-x-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-semibold text-brand">
                    <span>가장 가까운 배당</span>
                    <span aria-hidden="true" className="text-brand/40">·</span>
                    <span className="tnum">
                      {formatExDate(upcoming[0].exDate)} {dDayLabel(upcoming[0].days)}
                    </span>
                    <span aria-hidden="true" className="text-brand/40">·</span>
                    <span className="max-w-[10rem] truncate">{upcoming[0].name}</span>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                <div className="px-4 py-4 sm:px-6">
                  <p className="text-[13px] text-gray-500">{currentMonth}월 예상</p>
                  <p className="tnum mt-0.5 text-[16px] font-bold text-gray-900">
                    {formatKRW(monthlyTotals[currentMonth - 1])}원
                  </p>
                </div>
                <div className="px-4 py-4 sm:px-6">
                  <p className="text-[13px] text-gray-500">포트폴리오 배당률</p>
                  <p className="tnum mt-0.5 text-[16px] font-bold text-gray-900">
                    {portfolioYield != null ? `${portfolioYield.toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div className="px-4 py-4 sm:px-6">
                  <p className="text-[13px] text-gray-500">배당 종목</p>
                  <p className="tnum mt-0.5 text-[16px] font-bold text-gray-900">{payingCount}개</p>
                </div>
              </div>
            </section>

            <UpcomingDividends items={upcoming} today={today} />

            <MonthlyChart rows={rows} monthlyKRW={monthlyTotals} currentMonth={currentMonth} />

            {/* 종목별 배당 */}
            <section>
              <SectionTitle
                action={
                  isFetchingDividends ? (
                    <span className="text-[13px] font-medium text-gray-400">배당 정보 불러오는 중</span>
                  ) : undefined
                }
              >
                종목별 배당
              </SectionTitle>

              {/* 좁은 화면: 카드 목록 */}
              <ul className="card overflow-hidden lg:hidden">
                {rows.map((row) => (
                  <DividendCard key={row.asset.id} row={row} />
                ))}
              </ul>

              {/* 넓은 화면: 표 */}
              <div className="card hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[780px] text-[14px]">
                  <thead className="text-[12px] font-semibold text-gray-500">
                    <tr className="border-b border-gray-100">
                      {COLUMNS.map(({ label, align }) => (
                        <th
                          key={label}
                          className={`whitespace-nowrap px-3 py-3 ${
                            align === 'left' ? 'text-left' : 'text-right'
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ asset, name, info, yieldPct, annualKRW }) => (
                      <tr
                        key={asset.id}
                        className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <TickerAvatar asset={asset} />
                            <span className="min-w-0">
                              <span className="block max-w-[200px] truncate font-semibold text-gray-900">
                                {name}
                              </span>
                              <span className="block text-[12px] text-gray-400">
                                {asset.ticker} · {asset.quantity.toLocaleString()}주
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="tnum px-3 py-3.5 text-right text-gray-800">
                          <PerShare info={info} />
                        </td>
                        <td className="px-3 py-3.5">
                          <FrequencyChip paymentsPerYear={info?.paymentsPerYear} />
                        </td>
                        <td className="tnum px-3 py-3.5 text-right font-semibold text-gray-800">
                          {yieldPct != null ? `${yieldPct.toFixed(2)}%` : '—'}
                        </td>
                        <td className="tnum px-3 py-3.5 text-right text-gray-800">
                          <NextExDate info={info} />
                        </td>
                        <td className="tnum px-3 py-3.5 text-right font-bold text-gray-900">
                          <AnnualAmount annualKRW={annualKRW} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="px-1 text-[12px] leading-relaxed text-gray-400">
              최근 1년간 실제 지급된 배당을 기준으로 계산한 예상 금액이에요. 배당금이 바뀌거나 배당을
              건너뛰면 실제 금액과 달라질 수 있고, 배당소득세는 반영하지 않았어요.
            </p>
          </>
        )}
      </main>
    </>
  );
}
