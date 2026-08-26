import YahooFinance from 'yahoo-finance2';
import { unstable_cache } from 'next/cache';
import { type NextRequest } from 'next/server';
import { type DividendInfo, TTM_DAYS } from '@/app/lib/dividend';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** 배당 정보를 재사용하는 시간(초). 배당 이력은 하루에도 거의 바뀌지 않는다. */
const REVALIDATE_SECONDS = 60 * 60 * 6;

/** 한 번에 조회할 티커 수 상한 */
const MAX_TICKERS = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 최근 1년치를 빠짐없이 담으려면 조회 구간은 그보다 넉넉해야 한다. */
const LOOKBACK_DAYS = TTM_DAYS + 40;

/**
 * 배당락일을 `YYYY-MM-DD`로.
 *
 * Yahoo가 주는 배당락일 타임스탬프는 그 시장의 장 시작 시각(국내 00:00Z,
 * 미국 13:30Z 무렵)이라 UTC 날짜가 곧 현지 날짜다.
 */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 배당락일에 달을 더한다. 말일 배당락(1월 31일 등)은 그 달의 마지막 날로 맞춘다. */
function addMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toDateKey(target);
}

/**
 * Yahoo가 확정 발표한 다음 배당락일.
 *
 * ETF·암호화폐처럼 배당 일정 자체를 주지 않는 종목이 많아 실패는 정상 흐름으로 보고
 * null을 돌려준다. (이 경우 배당 주기로 추정한다)
 */
async function fetchConfirmedExDate(ticker: string): Promise<string | null> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] });
    const exDividendDate = summary.calendarEvents?.exDividendDate;
    return exDividendDate ? toDateKey(exDividendDate) : null;
  } catch {
    return null;
  }
}

/**
 * 다음 배당락일.
 *
 * Yahoo가 아직 오지 않은 배당락일을 알려주면 그 값을 쓰고, 없으면 마지막
 * 배당락일에 배당 주기를 더해 추정한다. 배당을 한 번 건너뛴 종목은 추정값이
 * 과거로 나올 수 있어 오늘 이후가 될 때까지 주기를 더한다.
 */
async function findNextExDate(
  ticker: string,
  lastExDate: string | null,
  paymentsPerYear: number,
  today: string,
): Promise<{ date: string | null; estimated: boolean }> {
  const confirmed = await fetchConfirmedExDate(ticker);
  if (confirmed && confirmed >= today) return { date: confirmed, estimated: false };

  if (!lastExDate || paymentsPerYear <= 0) return { date: null, estimated: false };

  const intervalMonths = Math.max(1, Math.round(12 / paymentsPerYear));
  let estimate = addMonths(lastExDate, intervalMonths);
  for (let i = 0; estimate < today && i < 12; i++) {
    estimate = addMonths(estimate, intervalMonths);
  }
  return { date: estimate, estimated: true };
}

/** 부동소수점 잔여 오차(3.2439999...)를 없앤다. 배당금은 소수 여섯째 자리까지면 충분하다. */
function round(amount: number): number {
  return Math.round(amount * 1e6) / 1e6;
}

/**
 * 최근 1년 배당을 달마다 모은다. (0월 = 1월)
 *
 * 월 배당 종목은 배당락일이 월말·월초로 흔들려 한 달에 두 번 잡히고 다음 달이 비는
 * 일이 흔하다. 이런 종목은 달마다 나눠 주는 편이 실제 지급 모습에 가깝다.
 */
function toMonthlyPerShare(recent: { amount: number; date: Date }[]): number[] {
  const annual = recent.reduce((sum, event) => sum + event.amount, 0);
  if (recent.length >= 11) return Array<number>(12).fill(round(annual / 12));

  const monthly = Array<number>(12).fill(0);
  for (const event of recent) {
    monthly[event.date.getUTCMonth()] += event.amount;
  }
  return monthly.map(round);
}

/**
 * 한 종목의 배당 이력을 정리한다. 조회에 실패하면(상장폐지 등) null.
 *
 * 배당 이벤트만 쓰기 때문에 시세 구간은 가장 굵은 `1mo`로 받아 응답을 줄인다.
 */
async function fetchDividendInfo(ticker: string, now: number): Promise<DividendInfo | null> {
  let chart;
  try {
    chart = await yahooFinance.chart(ticker, {
      period1: new Date(now - LOOKBACK_DAYS * DAY_MS),
      interval: '1mo',
      events: 'div',
      return: 'array',
    });
  } catch {
    return null;
  }

  const events = (chart.events?.dividends ?? [])
    .filter((event) => event.amount > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // 최근 1년 실적만 연간 배당·주기·월별 분포의 근거로 쓴다.
  const ttmStart = now - TTM_DAYS * DAY_MS;
  const recent = events.filter((event) => event.date.getTime() >= ttmStart);

  const last = events.at(-1);
  const lastExDate = last ? toDateKey(last.date) : null;
  const { date: nextExDate, estimated } = await findNextExDate(
    ticker,
    lastExDate,
    recent.length,
    toDateKey(new Date(now)),
  );

  return {
    ticker,
    currency: chart.meta?.currency ?? '',
    annualPerShare: round(recent.reduce((sum, event) => sum + event.amount, 0)),
    lastPerShare: last?.amount ?? null,
    lastExDate,
    nextExDate,
    nextExDateEstimated: estimated,
    paymentsPerYear: recent.length,
    monthlyPerShare: toMonthlyPerShare(recent),
  };
}

/**
 * 티커 묶음의 배당 정보를 모아 티커별로 정리해 돌려준다.
 *
 * unstable_cache의 캐시 키에 인자가 포함되므로 조회 기준 시각은 인자로 받지 않고
 * 안에서 정한다. 호출부에서 티커를 정렬·중복 제거해 넘겨야 캐시가 제대로 맞는다.
 */
const getDividends = unstable_cache(
  async (tickers: string[]): Promise<Record<string, DividendInfo>> => {
    const now = Date.now();
    const infos = await Promise.all(tickers.map((ticker) => fetchDividendInfo(ticker, now)));

    const result: Record<string, DividendInfo> = {};
    for (const info of infos) {
      if (info) result[info.ticker] = info;
    }
    return result;
  },
  ['dividends'],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * GET /api/dividend?tickers=AAPL,005930.KS
 *
 * 응답은 요청한 티커를 키로 하는 객체다. 조회에 실패한 티커는 생략된다.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tickers = [
    ...new Set(
      [...params.getAll('tickers'), ...params.getAll('ticker')]
        .flatMap((value) => value.split(','))
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].sort();

  if (tickers.length === 0) {
    return Response.json({ error: 'tickers 파라미터가 필요합니다.' }, { status: 400 });
  }
  if (tickers.length > MAX_TICKERS) {
    return Response.json(
      { error: `한 번에 최대 ${MAX_TICKERS}개까지 조회할 수 있습니다.` },
      { status: 400 },
    );
  }

  try {
    const dividends = await getDividends(tickers);
    return Response.json(dividends, {
      // 배당 정보는 사용자별 데이터가 아니므로 CDN에서도 재사용해도 된다.
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`,
      },
    });
  } catch {
    return Response.json({ error: '배당 정보를 불러오는 데 실패했습니다.' }, { status: 500 });
  }
}
