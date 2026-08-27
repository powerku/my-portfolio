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

/** 배당락일에 날을 더한다. (지급일 추정용) */
function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return toDateKey(new Date(Date.UTC(year, month - 1, day + days)));
}

/** 두 날짜 사이의 날수 */
function daysBetween(from: string, to: string): number {
  const toUTC = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/**
 * 배당락일 이후 지급일까지 걸리는 날수의 기본값. (그 종목의 확정 일정에서 실제
 * 간격을 알아낼 수 없을 때만 쓴다)
 *
 * ETF와 국내 종목은 Yahoo가 배당 일정을 아예 주지 않아, 시장 관행으로 어림한다.
 * 국내는 상법상 배당 결의 뒤 1개월 안에 지급하므로 기준일에서 한 달 반 정도 걸리고,
 * 연 1회 결산배당은 이듬해 정기 주주총회를 거쳐 3~4개월 뒤(보통 4월) 들어온다.
 * 미국은 배당락일 뒤 2~3주가 흔하고, 월 배당 ETF는 며칠 안에 들어온다.
 */
function defaultPayLagDays(ticker: string, paymentsPerYear: number): number {
  if (/\.(KS|KQ)$/i.test(ticker)) return paymentsPerYear <= 1 ? 100 : 45;
  return paymentsPerYear >= 11 ? 7 : 20;
}

/** 그 달에 없는 날은 마지막 날로 맞춘 날짜. (2월 30일 → 2월 28·29일) */
function dateInMonth(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return toDateKey(new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay))));
}

/** 배당락일에 달을 더한다. 말일 배당락(1월 31일 등)은 그 달의 마지막 날로 맞춘다. */
function addMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  return dateInMonth(target.getUTCFullYear(), target.getUTCMonth(), day);
}

/**
 * Yahoo가 확정 발표한 다음 배당 일정. (배당락일과 지급일)
 *
 * ETF·암호화폐처럼 배당 일정 자체를 주지 않는 종목이 많아 실패는 정상 흐름으로 보고
 * 빈 일정을 돌려준다. (이 경우 배당락일은 배당 주기로 추정한다)
 */
async function fetchConfirmedSchedule(ticker: string): Promise<{ exDate: string | null; payDate: string | null }> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] });
    const events = summary.calendarEvents;
    return {
      exDate: events?.exDividendDate ? toDateKey(events.exDividendDate) : null,
      payDate: events?.dividendDate ? toDateKey(events.dividendDate) : null,
    };
  } catch {
    return { exDate: null, payDate: null };
  }
}

/**
 * 다음 배당 일정.
 *
 * Yahoo가 아직 오지 않은 배당락일을 알려주면 그 값을 쓰고, 없으면 마지막
 * 배당락일에 배당 주기를 더해 추정한다. 배당을 한 번 건너뛴 종목은 추정값이
 * 과거로 나올 수 있어 오늘 이후가 될 때까지 주기를 더한다.
 *
 * 지급일도 확정 일정이 없으면 배당락일에 지급까지 걸리는 날수를 더해 추정한다.
 * 그 종목의 확정 일정이 있으면(지난 배당이어도) 거기서 실제 간격을 재고, 없으면
 * 시장 관행값을 쓴다. 배당락일만 알려주면 정작 언제 돈이 들어오는지 알 수 없어,
 * 추정값임을 함께 알리고 날짜를 채운다.
 */
async function findNextSchedule(
  ticker: string,
  lastExDate: string | null,
  paymentsPerYear: number,
  today: string,
): Promise<{
  date: string | null;
  estimated: boolean;
  payDate: string | null;
  payDateEstimated: boolean;
  /** 배당락일에서 지급일까지 걸리는 날수. 지난 배당의 지급일을 어림할 때도 쓴다. */
  payLagDays: number;
}> {
  const { exDate: confirmedExDate, payDate: confirmedPayDate } = await fetchConfirmedSchedule(ticker);

  // 지급일은 배당락일보다 뒤에 온다. 그렇지 않으면 서로 다른 회차의 값이라 간격을 못 잰다.
  const measuredLag =
    confirmedExDate && confirmedPayDate && confirmedPayDate >= confirmedExDate
      ? daysBetween(confirmedExDate, confirmedPayDate)
      : null;
  const payLag = measuredLag ?? defaultPayLagDays(ticker, paymentsPerYear);

  if (confirmedExDate && confirmedExDate >= today) {
    // 확정 배당락일에 짝이 맞는 지급일이 오면 그대로, 아니면 간격으로 추정한다.
    if (measuredLag != null) {
      return {
        date: confirmedExDate,
        estimated: false,
        payDate: confirmedPayDate,
        payDateEstimated: false,
        payLagDays: payLag,
      };
    }
    return {
      date: confirmedExDate,
      estimated: false,
      payDate: addDays(confirmedExDate, payLag),
      payDateEstimated: true,
      payLagDays: payLag,
    };
  }

  if (!lastExDate || paymentsPerYear <= 0) {
    return { date: null, estimated: false, payDate: null, payDateEstimated: false, payLagDays: payLag };
  }

  const intervalMonths = Math.max(1, Math.round(12 / paymentsPerYear));
  let estimate = addMonths(lastExDate, intervalMonths);
  for (let i = 0; estimate < today && i < 12; i++) {
    estimate = addMonths(estimate, intervalMonths);
  }
  return {
    date: estimate,
    estimated: true,
    payDate: addDays(estimate, payLag),
    payDateEstimated: true,
    payLagDays: payLag,
  };
}

/** 부동소수점 잔여 오차(3.2439999...)를 없앤다. 배당금은 소수 여섯째 자리까지면 충분하다. */
function round(amount: number): number {
  return Math.round(amount * 1e6) / 1e6;
}

/**
 * 최근 1년 배당을 지급일이 속한 달로 모은다. (0월 = 1월, 배당이 없는 달은 지급일이 null)
 *
 * 배당락일이 아니라 실제로 돈이 들어오는 달에 잡아야 "이번 달 배당"이 통장에 찍히는
 * 달과 맞는다. 배당 이력에는 지급일이 없어 배당락일에 지급까지 걸리는 날수를 더해
 * 어림하므로, 월별 지급일은 모두 어림값이다.
 *
 * 월 배당 종목은 지급일이 월말·월초로 흔들려 한 달에 두 번 잡히고 다음 달이 비는 일이
 * 흔하다. 이런 종목은 달마다 나눠 주는 편이 실제 지급 모습에 가깝고, 비는 달의 지급일은
 * 다른 달의 흔한 지급 날짜를 그 달에 옮겨 어림한다.
 */
function toMonthlyDividends(
  recent: { amount: number; date: Date }[],
  payLagDays: number,
): { monthlyPerShare: number[]; monthlyPayDate: (string | null)[] } {
  const payments = recent.map((event) => ({
    amount: event.amount,
    payDate: addDays(toDateKey(event.date), payLagDays),
  }));
  const monthOf = (dateKey: string) => Number(dateKey.slice(5, 7)) - 1;

  const perShare = Array<number>(12).fill(0);
  const payDates = Array<string | null>(12).fill(null);
  for (const payment of payments) {
    const month = monthOf(payment.payDate);
    perShare[month] += payment.amount;
    payDates[month] = payment.payDate;
  }

  const last = payments.at(-1);
  if (!last || payments.length < 11) {
    return { monthlyPerShare: perShare.map(round), monthlyPayDate: payDates };
  }

  const annual = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const lastMonth = monthOf(last.payDate);
  const days = payments.map((payment) => Number(payment.payDate.slice(8, 10))).sort((a, b) => a - b);
  const typicalDay = days[Math.floor(days.length / 2)];

  return {
    monthlyPerShare: Array<number>(12).fill(round(annual / 12)),
    monthlyPayDate: payDates.map((payDate, month) => {
      if (payDate) return payDate;
      // 최근 1년 안의 그 달을 가리키도록, 마지막 지급일보다 뒤의 달이면 한 해 앞으로 돌린다.
      const year = Number(last.payDate.slice(0, 4)) - (month > lastMonth ? 1 : 0);
      return dateInMonth(year, month, typicalDay);
    }),
  };
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
  const { date: nextExDate, estimated, payDate, payDateEstimated, payLagDays } = await findNextSchedule(
    ticker,
    lastExDate,
    recent.length,
    toDateKey(new Date(now)),
  );

  const { monthlyPerShare, monthlyPayDate } = toMonthlyDividends(recent, payLagDays);

  return {
    ticker,
    currency: chart.meta?.currency ?? '',
    annualPerShare: round(recent.reduce((sum, event) => sum + event.amount, 0)),
    lastPerShare: last?.amount ?? null,
    lastExDate,
    nextExDate,
    nextExDateEstimated: estimated,
    nextPayDate: payDate,
    nextPayDateEstimated: payDateEstimated,
    paymentsPerYear: recent.length,
    monthlyPerShare,
    monthlyPayDate,
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
  // 응답에 담는 값이 바뀌면 버전을 올린다. 그러지 않으면 예전 모양의 응답이
  // 캐시가 만료될 때까지(REVALIDATE_SECONDS) 그대로 나간다.
  ['dividends', 'v4'],
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
