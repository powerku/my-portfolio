/**
 * 서버에서 Yahoo Finance 시세를 받아오는 공통 함수.
 *
 * 국내 종목은 한글 이름을 받기 위해 `lang: ko-KR`로 조회해야 하는데, 이 옵션을
 * 해외 종목에까지 걸면 표기 통화가 달라질 위험이 있다. 그래서 국내/해외를 나눠
 * 각각 배치로 호출한다. (호출 수는 티커 개수와 무관하게 최대 2회)
 *
 * 시세 조회(`/api/quote`)와 기본 포트폴리오 구성(`/api/default-assets`)이 같은
 * 규칙을 쓰도록 여기 한 곳에 둔다.
 */

import YahooFinance from 'yahoo-finance2';
import { isKoreanTicker } from '@/app/lib/kr-assets';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface YahooQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
}

export async function fetchYahooQuotes(tickers: string[]): Promise<YahooQuote[]> {
  const korean = tickers.filter(isKoreanTicker);
  const overseas = tickers.filter((t) => !isKoreanTicker(t));

  const [koreanQuotes, overseasQuotes] = await Promise.all([
    korean.length > 0 ? yahooFinance.quote(korean, { lang: 'ko-KR', region: 'KR' }) : [],
    overseas.length > 0 ? yahooFinance.quote(overseas) : [],
  ]);

  // 응답 타입이 시세 종류별 유니온이라 그대로 넘기면 다루기 번거롭다.
  // 화면·계산에 쓰는 필드만 담은 한 가지 형태로 정리해 돌려준다.
  return [...koreanQuotes, ...overseasQuotes].flatMap((q) => {
    const quote = q as Partial<YahooQuote>;
    if (!quote.symbol) return [];

    return [
      {
        symbol: quote.symbol,
        shortName: quote.shortName,
        longName: quote.longName,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        marketCap: quote.marketCap,
      },
    ];
  });
}
