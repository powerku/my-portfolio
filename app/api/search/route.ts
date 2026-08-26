import YahooFinance from 'yahoo-finance2';
import { type NextRequest } from 'next/server';
import { CRYPTO_ASSETS, KR_STOCKS, resolveAssetName } from '@/app/lib/kr-assets';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** 자동완성 목록에 보여줄 최대 개수 */
const MAX_RESULTS = 8;

interface SearchItem {
  ticker: string;
  name: string;
  typeDisp: string;
}

/**
 * Yahoo의 `quoteType`을 내장 목록과 같은 표기로 맞춘다.
 *
 * `lang: ko-KR`로 검색하면 `typeDisp`가 한글("주식", "암호화폐")로 오는데,
 * 내장 목록은 영문 표기를 쓰므로 한 목록에 섞이면 배지가 들쭉날쭉해진다.
 */
const TYPE_LABELS: Record<string, string> = {
  EQUITY: 'Equity',
  ETF: 'ETF',
  CRYPTOCURRENCY: 'Cryptocurrency',
  MUTUALFUND: 'Fund',
  INDEX: 'Index',
  CURRENCY: 'Currency',
  FUTURE: 'Future',
};

function hasKorean(str: string) {
  return /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(str);
}

/**
 * 코드는 앞에서부터 맞을 때만 찾은 것으로 본다.
 *
 * 부분 일치로 두면 `s` 한 글자에 `.KS` 종목이 전부 걸려 목록을 덮어버린다.
 * `005930`, `00593`(입력 중), `005930.KS` 모두 맞고 `s`는 걸리지 않는다.
 */
function matchesTicker(ticker: string, lower: string) {
  const full = ticker.toLowerCase();
  return full === lower || full.split('.')[0].startsWith(lower);
}

/**
 * 내장 국내 주식 목록 검색.
 *
 * `matchName`이 꺼져 있으면 코드로만 찾는다. 영문 질의에서 이름까지 부분일치로
 * 보면 `s` 한 글자에 "SK하이닉스"·"삼성SDI" 같은 종목이 목록을 채워 Yahoo 결과를
 * 밀어내기 때문이다. 이제 Yahoo도 국내 종목을 한글 이름으로 주므로 이름 검색은
 * 한글 질의(= Yahoo가 거부하는 질의)에서만 쓰면 된다.
 */
function searchKrStocks(q: string, matchName: boolean): SearchItem[] {
  const lower = q.toLowerCase();
  return KR_STOCKS.filter(
    (s) => (matchName && s.name.includes(q)) || matchesTicker(s.ticker, lower),
  ).slice(0, MAX_RESULTS);
}

function searchCrypto(q: string): SearchItem[] {
  const lower = q.toLowerCase();
  return CRYPTO_ASSETS.filter(
    (s) =>
      s.name.includes(q) ||
      s.nameEn.toLowerCase().includes(lower) ||
      matchesTicker(s.ticker, lower),
  ).map((s) => ({ ticker: s.ticker, name: s.name, typeDisp: s.typeDisp }));
}

/**
 * Yahoo Finance 종목 검색.
 *
 * 국내 종목의 한글 이름은 `lang: ko-KR`로 물어봐야 `longname`에 담겨 온다.
 * (예: `005930` → "삼성전자(주)", `042660` → "한화오션(주)") 기본 설정으로는
 * 로마자 이름만 오기 때문에 코드로 검색하면 종목명이 영문으로 나온다.
 *
 * 다만 이 응답은 `typeDisp`가 한글이어서 yahoo-finance2의 스키마 검증에 걸린다.
 * 이름을 얻는 것이 목적이니 `validateResult: false`로 검증을 끄고, 쓰는 필드만
 * 직접 확인해서 읽는다. (해외 종목 결과는 기본 검색과 같다)
 */
async function searchYahoo(query: string): Promise<SearchItem[]> {
  const result = await yahooFinance.search(
    query,
    { lang: 'ko-KR', region: 'KR' },
    { validateResult: false },
  );

  const quotes = (result as { quotes?: Record<string, unknown>[] }).quotes ?? [];
  const asString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

  return quotes.flatMap((item) => {
    const symbol = asString(item.symbol);
    if (!symbol) return [];
    return [
      {
        ticker: symbol,
        name: resolveAssetName(symbol, {
          shortName: asString(item.shortname),
          longName: asString(item.longname),
        }),
        typeDisp: TYPE_LABELS[asString(item.quoteType) ?? ''] ?? '',
      },
    ];
  });
}

/** 앞쪽 목록을 우선해 티커 중복을 없애고 개수를 맞춘다. */
function merge(...lists: SearchItem[][]): SearchItem[] {
  const seen = new Set<string>();
  const merged: SearchItem[] = [];

  for (const item of lists.flat()) {
    const key = item.ticker.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= MAX_RESULTS) break;
  }

  return merged;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q || q.trim().length < 1) {
    return Response.json([]);
  }

  const query = q.trim();
  const korean = hasKorean(query);

  // 내장 목록(주식 + 암호화폐). 한글 이름이 확실하므로 Yahoo 결과보다 앞에 둔다.
  const local = merge(searchKrStocks(query, korean), searchCrypto(query));

  // Yahoo 검색은 한글 질의를 거부한다(Invalid Search Query). 내장 목록으로만 답한다.
  if (korean) {
    return Response.json(local);
  }

  try {
    return Response.json(merge(local, await searchYahoo(query)));
  } catch {
    // Yahoo Finance 검색 실패 시 내장 목록에서 폴백
    return Response.json(local);
  }
}
