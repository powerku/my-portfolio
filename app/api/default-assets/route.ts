import { unstable_cache } from 'next/cache';
import {
  type AssetCategory,
  CATEGORIES,
  defaultAllocations,
} from '@/app/lib/portfolio';
import {
  type DefaultAsset,
  DEFAULT_TICKER_CANDIDATES,
  defaultCandidateTickers,
  sharesForAmount,
  splitByWeight,
} from '@/app/lib/portfolio-defaults';
import { EXCHANGE_RATE_TICKER, getQuoteCurrency } from '@/app/lib/quotes';
import { fetchYahooQuotes } from '@/app/lib/yahoo';

/** 구성을 재사용하는 시간(초). 후보와 비중이 고정이라 캐시 키는 항상 같다. */
const REVALIDATE_SECONDS = 60;

interface Candidate {
  price: number;
  marketCap: number;
}

/**
 * 후보 중에서 담을 종목을 고른다.
 *
 * 시가총액이 큰 종목을 우선하고, 시가총액이 오지 않는 ETF는 후보 순서를 따른다.
 * 시세가 없는 종목은 수량을 계산할 수 없으므로 제외한다.
 */
function pickTicker(candidates: string[], quotes: Map<string, Candidate>): string | undefined {
  const available = candidates.filter((t) => quotes.has(t));
  if (available.length === 0) return undefined;

  return available.reduce((best, ticker) =>
    (quotes.get(ticker)!.marketCap > quotes.get(best)!.marketCap ? ticker : best),
  );
}

/**
 * 기본 포트폴리오를 시세 기준으로 구성한다.
 *
 * 목표 비중대로 카테고리별 금액을 정하고, 그 금액에 가장 가까운 정수 주수를 낸다.
 * 매수 단가는 종목의 시세 통화(국내 종목 KRW / 그 외 USD) 그대로 저장한다.
 */
const buildDefaultAssets = unstable_cache(
  async (): Promise<DefaultAsset[]> => {
    const quotes = await fetchYahooQuotes([EXCHANGE_RATE_TICKER, ...defaultCandidateTickers()]);

    const bySymbol = new Map<string, Candidate>();
    for (const quote of quotes) {
      const price = quote.regularMarketPrice;
      if (price == null || price <= 0) continue;
      bySymbol.set(quote.symbol.toUpperCase(), { price, marketCap: quote.marketCap ?? 0 });
    }

    const exchangeRate = bySymbol.get(EXCHANGE_RATE_TICKER)?.price;
    if (!exchangeRate) throw new Error('환율을 불러오지 못했습니다.');

    // 담을 종목을 먼저 정하고, 정해진 카테고리끼리 금액을 나눈다.
    const allocations = defaultAllocations();
    const picked = CATEGORIES.flatMap((category: AssetCategory) => {
      const candidates = DEFAULT_TICKER_CANDIDATES[category];
      const weight = allocations[category] ?? 0;
      if (!candidates || weight <= 0) return [];

      const ticker = pickTicker(candidates, bySymbol);
      return ticker ? [{ category, weight, ticker }] : [];
    });

    const amounts = splitByWeight(picked);

    return picked.flatMap(({ category, ticker }) => {
      const price = bySymbol.get(ticker)!.price;
      const currency = getQuoteCurrency(ticker);
      const priceKRW = currency === 'USD' ? price * exchangeRate : price;
      const quantity = sharesForAmount(amounts.get(category) ?? 0, priceKRW);

      return [{ ticker, category, quantity, purchasePrice: price, purchaseCurrency: currency }];
    });
  },
  ['default-assets'],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * GET /api/default-assets
 *
 * 최초 로그인 시 채워 넣을 자산 목록. 시세가 필요해서 서버에서 계산한다.
 */
export async function GET() {
  try {
    return Response.json(await buildDefaultAssets(), {
      // 사용자별 데이터가 아니므로 CDN에서도 잠깐 재사용해도 된다.
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS * 5}`,
      },
    });
  } catch {
    return Response.json({ error: '기본 포트폴리오를 만들지 못했습니다.' }, { status: 500 });
  }
}
