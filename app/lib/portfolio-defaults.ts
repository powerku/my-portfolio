/**
 * 최초 로그인 시 채워 넣는 기본 포트폴리오.
 *
 * 카테고리별로 대표 종목 하나씩 담고, 총 매수 금액이 DEFAULT_TOTAL_KRW에 가깝도록
 * 목표 비중(`defaultAllocations`)에 맞춰 주수를 나눈다. 실제 종목과 주수는 시세를
 * 봐야 정해지므로 서버(`/api/default-assets`)에서 계산한다.
 *
 * 서버와 화면이 같은 구성을 쓰도록 종목 후보와 금액 규칙은 여기 한 곳에 둔다.
 */

import { type AssetCategory, type Currency } from '@/app/lib/portfolio';

/** 기본 포트폴리오가 목표로 하는 총 매수 금액(원) */
export const DEFAULT_TOTAL_KRW = 1_000_000;

/**
 * 목표 금액에 가장 가까운 정수 주수. 최소 1주는 담는다.
 *
 * 실제 매매처럼 주수는 정수로 둔다. 대신 종목 단가가 커서(삼성전자 26만원대,
 * NVDA 29만원대) 카테고리별 금액이 목표에서 최대 반 주만큼 벗어나고, 총 매수
 * 금액도 DEFAULT_TOTAL_KRW에 딱 맞지는 않는다.
 */
export function sharesForAmount(amountKRW: number, priceKRW: number): number {
  return Math.max(1, Math.round(amountKRW / priceKRW));
}

/**
 * 카테고리별 종목 후보.
 *
 * 후보가 여러 개면 시가총액 1위를 고른다. "시총 1위"는 시간이 지나면 바뀌므로
 * 티커를 하나로 못 박지 않고 상위 종목을 후보로 두고 조회 시점에 정한다.
 * ETF는 시가총액이 오지 않으므로 후보를 하나만 둔다.
 */
export const DEFAULT_TICKER_CANDIDATES: Partial<Record<AssetCategory, string[]>> = {
  // 미국 시총 상위 종목 (조회 시점 1위를 고른다)
  '미국주식': ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'AVGO', 'META', 'TSLA'],
  // 미국 장기 국채 ETF
  '미국채권': ['TLT'],
  // 국내 시총 상위 종목 (조회 시점 1위를 고른다)
  '국내주식': ['005930.KS', '000660.KS', '373220.KS', '207940.KS', '105560.KS'],
  // 국내 상장 국고채 ETF
  '국내채권': ['148070.KS'],
  // 국내 상장 금 현물 ETF
  '금': ['411060.KS'],
};

/** 기본 포트폴리오로 등록할 한 종목 (id는 저장할 때 붙인다) */
export interface DefaultAsset {
  ticker: string;
  category: AssetCategory;
  quantity: number;
  purchasePrice: number;
  purchaseCurrency: Currency;
}

/** 후보 티커 전체 (중복 제거) */
export function defaultCandidateTickers(): string[] {
  return [...new Set(Object.values(DEFAULT_TICKER_CANDIDATES).flat())];
}

/**
 * 카테고리 목표 비중을 총 매수 금액에 나눠 담는다.
 *
 * 담을 종목을 못 찾은 카테고리는 빠지므로, 남은 카테고리의 비중 합으로 다시
 * 나눠야 총액이 DEFAULT_TOTAL_KRW에 맞는다. (기본 비중 합도 100이 아니다)
 */
export function splitByWeight(
  weights: { category: AssetCategory; weight: number }[],
  totalKRW = DEFAULT_TOTAL_KRW,
): Map<AssetCategory, number> {
  const sum = weights.reduce((acc, w) => acc + w.weight, 0);
  if (sum <= 0) return new Map();
  return new Map(weights.map((w) => [w.category, (totalKRW * w.weight) / sum]));
}
