/**
 * 국내 상장 종목·암호화폐의 한글 이름 목록.
 *
 * 종목 검색(`/api/search`)과 시세 조회(`/api/quote`)가 같은 이름을 쓰도록 여기서 관리한다.
 * Yahoo Finance는 국내 종목의 `shortName`을 로마자로 주기 때문에(예: 삼성전자 → "SamsungElec")
 * 화면에 쓸 이름은 이 목록을 우선한다.
 */

export interface KrStock {
  ticker: string;
  name: string;
  typeDisp: string;
}

export interface CryptoAsset {
  ticker: string;
  name: string;
  nameEn: string;
  typeDisp: string;
}

// 주요 한국 주식 목록 (한국어 검색용)
export const KR_STOCKS: KrStock[] = [
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
  // 채권·금 ETF (기본 포트폴리오에서 쓴다)
  { ticker: '148070.KS', name: 'KOSEF 국고채10년', typeDisp: 'ETF' },
  { ticker: '385560.KS', name: 'RISE 국고채30년Enhanced', typeDisp: 'ETF' },
  { ticker: '114260.KS', name: 'KODEX 국고채3년', typeDisp: 'ETF' },
  { ticker: '411060.KS', name: 'ACE KRX금현물', typeDisp: 'ETF' },
  { ticker: '132030.KS', name: 'KODEX 골드선물(H)', typeDisp: 'ETF' },
];

// 주요 암호화폐 목록
export const CRYPTO_ASSETS: CryptoAsset[] = [
  { ticker: 'BTC-USD', name: '비트코인', nameEn: 'Bitcoin', typeDisp: 'Cryptocurrency' },
  { ticker: 'ETH-USD', name: '이더리움', nameEn: 'Ethereum', typeDisp: 'Cryptocurrency' },
  { ticker: 'XRP-USD', name: '리플', nameEn: 'XRP', typeDisp: 'Cryptocurrency' },
  { ticker: 'SOL-USD', name: '솔라나', nameEn: 'Solana', typeDisp: 'Cryptocurrency' },
  { ticker: 'BNB-USD', name: '바이낸스코인', nameEn: 'BNB', typeDisp: 'Cryptocurrency' },
  { ticker: 'DOGE-USD', name: '도지코인', nameEn: 'Dogecoin', typeDisp: 'Cryptocurrency' },
  { ticker: 'ADA-USD', name: '에이다', nameEn: 'Cardano', typeDisp: 'Cryptocurrency' },
  { ticker: 'AVAX-USD', name: '아발란체', nameEn: 'Avalanche', typeDisp: 'Cryptocurrency' },
];

/** 티커 → 한글 종목명 */
const KR_NAME_BY_TICKER = new Map(KR_STOCKS.map((s) => [s.ticker.toUpperCase(), s.name]));

/** 국내 상장 종목인지 (코스피 `.KS` / 코스닥 `.KQ`) */
export function isKoreanTicker(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  return upper.endsWith('.KS') || upper.endsWith('.KQ');
}

/** 목록에 등록된 한글 종목명 */
export function findKoreanName(ticker: string): string | undefined {
  return KR_NAME_BY_TICKER.get(ticker.toUpperCase());
}

/**
 * 화면에 쓸 종목명.
 *
 * 국내 상장 종목은 Yahoo가 로마자 이름을 주기 때문에(삼성전자 → "SamsungElec")
 * 등록된 한글 이름 → 다듬은 한글 법인명 순으로 고른다. 해외 종목은 Yahoo가 주는
 * 이름을 그대로 쓴다.
 *
 * 서버(`/api/quote`)와 화면이 같은 규칙을 쓰도록 여기 한 곳에 둔다. 화면에서는
 * 시세를 아직 못 받았거나 조회에 실패해도 등록된 한글 이름은 바로 보여줄 수 있다.
 *
 * Yahoo의 이름은 끝에 공백이 붙어 오는 경우가 있어(예: TLT → "iShares 20+ Year
 * Treasury Bond ") 반드시 다듬어서 돌려준다. 공백이 남으면 검색 결과로 채운
 * 이름과 사용자가 입력한 이름이 달라져 자산 등록이 막힌다.
 */
export function resolveAssetName(
  ticker: string,
  names: { shortName?: string; longName?: string } = {},
): string {
  if (isKoreanTicker(ticker)) {
    const known = findKoreanName(ticker);
    if (known) return known;
    if (names.longName) return cleanKoreanName(names.longName);
  }
  const name = names.shortName?.trim() || names.longName?.trim();
  return name || ticker;
}

/**
 * Yahoo가 주는 국내 종목 법인명을 화면용으로 다듬는다.
 * 예) " 에이치디현대중공업(주)" → "에이치디현대중공업"
 *     "미래에셋TIGER미국나스닥100증권상장지수투자신탁(주식)" → "미래에셋TIGER미국나스닥100"
 */
export function cleanKoreanName(name: string): string {
  const cleaned = name
    .trim()
    // 펀드 정식명칭의 꼬리표
    .replace(/증권?\s*상장지수투자신탁.*$/, '')
    // 법인 표기
    .replace(/^\(주\)\s*/, '')
    .replace(/\(주\)$/, '')
    .replace(/^주식회사\s*/, '')
    .replace(/\s*주식회사$/, '')
    .trim();

  return cleaned || name.trim();
}
