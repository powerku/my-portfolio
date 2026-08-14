import YahooFinance from 'yahoo-finance2';
import { type NextRequest } from 'next/server';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// 주요 한국 주식 목록 (한국어 검색용)
const KR_STOCKS = [
  // KOSPI 대형주
  { ticker: '005930.KS', name: '삼성전자', typeDisp: 'Equity' },
  { ticker: '000660.KS', name: 'SK하이닉스', typeDisp: 'Equity' },
  { ticker: '373220.KS', name: 'LG에너지솔루션', typeDisp: 'Equity' },
  { ticker: '207940.KS', name: '삼성바이오로직스', typeDisp: 'Equity' },
  { ticker: '005380.KS', name: '현대차', typeDisp: 'Equity' },
  { ticker: '000270.KS', name: '기아', typeDisp: 'Equity' },
  { ticker: '068270.KS', name: '셀트리온', typeDisp: 'Equity' },
  { ticker: '005490.KS', name: 'POSCO홀딩스', typeDisp: 'Equity' },
  { ticker: '006400.KS', name: '삼성SDI', typeDisp: 'Equity' },
  { ticker: '105560.KS', name: 'KB금융', typeDisp: 'Equity' },
  { ticker: '055550.KS', name: '신한지주', typeDisp: 'Equity' },
  { ticker: '035720.KS', name: '카카오', typeDisp: 'Equity' },
  { ticker: '035420.KS', name: 'NAVER', typeDisp: 'Equity' },
  { ticker: '086790.KS', name: '하나금융지주', typeDisp: 'Equity' },
  { ticker: '051910.KS', name: 'LG화학', typeDisp: 'Equity' },
  { ticker: '028260.KS', name: '삼성물산', typeDisp: 'Equity' },
  { ticker: '066570.KS', name: 'LG전자', typeDisp: 'Equity' },
  { ticker: '012330.KS', name: '현대모비스', typeDisp: 'Equity' },
  { ticker: '096770.KS', name: 'SK이노베이션', typeDisp: 'Equity' },
  { ticker: '017670.KS', name: 'SK텔레콤', typeDisp: 'Equity' },
  { ticker: '030200.KS', name: 'KT', typeDisp: 'Equity' },
  { ticker: '034730.KS', name: 'SK', typeDisp: 'Equity' },
  { ticker: '010130.KS', name: '고려아연', typeDisp: 'Equity' },
  { ticker: '034020.KS', name: '두산에너빌리티', typeDisp: 'Equity' },
  { ticker: '259960.KS', name: '크래프톤', typeDisp: 'Equity' },
  { ticker: '000810.KS', name: '삼성화재', typeDisp: 'Equity' },
  { ticker: '316140.KS', name: '우리금융지주', typeDisp: 'Equity' },
  { ticker: '003550.KS', name: 'LG', typeDisp: 'Equity' },
  { ticker: '011170.KS', name: '롯데케미칼', typeDisp: 'Equity' },
  { ticker: '009150.KS', name: '삼성전기', typeDisp: 'Equity' },
  { ticker: '018260.KS', name: '삼성에스디에스', typeDisp: 'Equity' },
  { ticker: '032830.KS', name: '삼성생명', typeDisp: 'Equity' },
  { ticker: '015760.KS', name: '한국전력', typeDisp: 'Equity' },
  { ticker: '047050.KS', name: '포스코인터내셔널', typeDisp: 'Equity' },
  // KOSDAQ
  { ticker: '247540.KQ', name: '에코프로비엠', typeDisp: 'Equity' },
  { ticker: '086520.KQ', name: '에코프로', typeDisp: 'Equity' },
  { ticker: '028300.KQ', name: 'HLB', typeDisp: 'Equity' },
  { ticker: '293490.KQ', name: '카카오게임즈', typeDisp: 'Equity' },
  { ticker: '357780.KQ', name: '솔브레인', typeDisp: 'Equity' },
  { ticker: '112040.KQ', name: '위메이드', typeDisp: 'Equity' },
  // ETF
  { ticker: '069500.KS', name: 'KODEX 200', typeDisp: 'ETF' },
  { ticker: '229200.KQ', name: 'KODEX 코스닥150', typeDisp: 'ETF' },
  { ticker: '122630.KS', name: 'KODEX 레버리지', typeDisp: 'ETF' },
  { ticker: '252670.KS', name: 'KODEX 200선물인버스2X', typeDisp: 'ETF' },
  { ticker: '360750.KS', name: 'TIGER 미국S&P500', typeDisp: 'ETF' },
  { ticker: '379800.KS', name: 'KODEX 미국S&P500TR', typeDisp: 'ETF' },
  { ticker: '133690.KS', name: 'TIGER 미국나스닥100', typeDisp: 'ETF' },
  { ticker: '114800.KS', name: 'KODEX 인버스', typeDisp: 'ETF' },
  { ticker: '148020.KS', name: 'KBSTAR 미국S&P500', typeDisp: 'ETF' },
  { ticker: '453850.KS', name: 'KODEX 미국반도체MV', typeDisp: 'ETF' },
];

// 주요 암호화폐 목록
const CRYPTO_ASSETS = [
  { ticker: 'BTC-USD', name: '비트코인', nameEn: 'Bitcoin', typeDisp: 'Cryptocurrency' },
  { ticker: 'ETH-USD', name: '이더리움', nameEn: 'Ethereum', typeDisp: 'Cryptocurrency' },
  { ticker: 'XRP-USD', name: '리플', nameEn: 'XRP', typeDisp: 'Cryptocurrency' },
  { ticker: 'SOL-USD', name: '솔라나', nameEn: 'Solana', typeDisp: 'Cryptocurrency' },
  { ticker: 'BNB-USD', name: '바이낸스코인', nameEn: 'BNB', typeDisp: 'Cryptocurrency' },
  { ticker: 'DOGE-USD', name: '도지코인', nameEn: 'Dogecoin', typeDisp: 'Cryptocurrency' },
  { ticker: 'ADA-USD', name: '에이다', nameEn: 'Cardano', typeDisp: 'Cryptocurrency' },
  { ticker: 'AVAX-USD', name: '아발란체', nameEn: 'Avalanche', typeDisp: 'Cryptocurrency' },
];

function hasKorean(str: string) {
  return /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(str);
}

function searchKrStocks(q: string) {
  const lower = q.toLowerCase();
  return KR_STOCKS.filter(
    (s) =>
      s.name.includes(q) ||
      s.ticker.toLowerCase().includes(lower),
  ).slice(0, 8);
}

function searchCrypto(q: string) {
  const lower = q.toLowerCase();
  return CRYPTO_ASSETS.filter(
    (s) =>
      s.name.includes(q) ||
      s.nameEn.toLowerCase().includes(lower) ||
      s.ticker.toLowerCase().includes(lower),
  ).map(({ nameEn: _n, ...rest }) => rest);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q || q.trim().length < 1) {
    return Response.json([]);
  }

  const query = q.trim();

  // 한국어가 포함된 경우 내장 목록(주식 + 암호화폐)에서 검색
  if (hasKorean(query)) {
    const krResults = searchKrStocks(query);
    const cryptoResults = searchCrypto(query);
    return Response.json([...krResults, ...cryptoResults].slice(0, 8));
  }

  // 암호화폐 영문/티커 검색 우선
  const cryptoMatches = searchCrypto(query);

  // 영문/숫자 → Yahoo Finance 검색
  try {
    const result = await yahooFinance.search(query);
    const quotes = (result.quotes ?? [])
      .filter((item) => item.symbol)
      .slice(0, 8)
      .map((item) => {
        const anyItem = item as Record<string, unknown>;
        return {
          ticker: item.symbol as string,
          name: (anyItem.shortname as string | undefined)
            ?? (anyItem.longname as string | undefined)
            ?? item.symbol as string,
          typeDisp: (anyItem.typeDisp as string | undefined) ?? '',
        };
      });

    // 암호화폐 결과를 앞에 배치하고 중복 제거
    const cryptoTickers = new Set(cryptoMatches.map((c) => c.ticker));
    const filtered = quotes.filter((q) => !cryptoTickers.has(q.ticker));
    return Response.json([...cryptoMatches, ...filtered].slice(0, 8));
  } catch {
    // Yahoo Finance 검색 실패 시 내장 목록에서 폴백
    return Response.json([...searchKrStocks(query), ...cryptoMatches].slice(0, 8));
  }
}
