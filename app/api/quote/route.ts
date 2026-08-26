import YahooFinance from 'yahoo-finance2';
import { unstable_cache } from 'next/cache';
import { type NextRequest } from 'next/server';
import { isKoreanTicker, resolveAssetName } from '@/app/lib/kr-assets';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** 시세를 재사용하는 시간(초) */
const REVALIDATE_SECONDS = 60;

/** 한 번에 조회할 티커 수 상한 */
const MAX_TICKERS = 50;

interface QuoteResult {
  ticker: string;
  shortName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

/**
 * 티커 묶음을 Yahoo Finance에 한 번에 물어보고 티커별로 정리해 돌려준다.
 *
 * 국내 종목은 한글 이름을 받기 위해 `lang: ko-KR`로 조회해야 하는데, 이 옵션을
 * 해외 종목에까지 걸면 표기 통화가 달라질 위험이 있다. 그래서 국내/해외를 나눠
 * 각각 배치로 호출한다. (호출 수는 티커 개수와 무관하게 최대 2회)
 *
 * unstable_cache의 캐시 키에 인자가 포함되므로, 같은 티커 조합이면
 * REVALIDATE_SECONDS 동안 Yahoo를 다시 호출하지 않는다. 호출부에서 티커를
 * 정렬·중복 제거해 넘겨야 캐시가 제대로 맞는다.
 */
const getQuotes = unstable_cache(
  async (tickers: string[]): Promise<Record<string, QuoteResult>> => {
    const korean = tickers.filter(isKoreanTicker);
    const overseas = tickers.filter((t) => !isKoreanTicker(t));

    const [koreanQuotes, overseasQuotes] = await Promise.all([
      korean.length > 0 ? yahooFinance.quote(korean, { lang: 'ko-KR', region: 'KR' }) : [],
      overseas.length > 0 ? yahooFinance.quote(overseas) : [],
    ]);

    const bySymbol = new Map(
      [...koreanQuotes, ...overseasQuotes].map((q) => [
        q.symbol.toUpperCase(),
        {
          ticker: q.symbol,
          shortName: resolveAssetName(q.symbol, { shortName: q.shortName, longName: q.longName }),
          price: q.regularMarketPrice ?? null,
          change: q.regularMarketChange ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
        },
      ]),
    );

    // 요청한 티커를 키로 돌려준다. 상장폐지 등으로 Yahoo가 빼먹은 티커는 생략된다.
    const result: Record<string, QuoteResult> = {};
    for (const ticker of tickers) {
      const quote = bySymbol.get(ticker.toUpperCase());
      if (quote) result[ticker] = quote;
    }
    return result;
  },
  ['quotes'],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * GET /api/quote?tickers=AAPL,005930.KS,USDKRW=X
 *
 * 응답은 요청한 티커를 키로 하는 객체다. (`ticker` 파라미터도 같은 뜻으로 받는다)
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
    const quotes = await getQuotes(tickers);
    return Response.json(quotes, {
      // 시세는 사용자별 데이터가 아니므로 CDN에서도 잠깐 재사용해도 된다.
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS * 5}`,
      },
    });
  } catch {
    return Response.json({ error: '시세를 불러오는 데 실패했습니다.' }, { status: 500 });
  }
}
