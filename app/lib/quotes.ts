/**
 * 시세 조회와 원화 환산·금액 표기 규칙.
 *
 * 포트폴리오 화면과 배당 화면이 같은 시세·환율·표기를 쓰도록 여기 한 곳에 둔다.
 */

import { type Asset, type Currency } from '@/app/lib/portfolio';

export interface Quote {
  ticker: string;
  shortName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

/** 원/달러 환율도 시세와 같은 방식으로 조회한다 */
export const EXCHANGE_RATE_TICKER = 'USDKRW=X';

/** 여러 티커 시세를 한 번에 조회. 실패하면 빈 결과를 돌려준다. */
export async function fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`/api/quote?tickers=${encodeURIComponent(tickers.join(','))}`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    // 시세 조회 실패 시 매수 단가 기준으로 계산되므로 무시한다.
    return {};
  }
}

/** 원화로 변환 */
export function toKRW(amount: number, currency: Currency, exchangeRate: number): number {
  return currency === 'USD' ? amount * exchangeRate : amount;
}

/** 티커로 Yahoo Finance 시세 통화 판별 (한국 주식 → KRW, 그 외 → USD) */
export function getQuoteCurrency(ticker: string): Currency {
  return ticker.endsWith('.KS') || ticker.endsWith('.KQ') ? 'KRW' : 'USD';
}

/** Yahoo Finance 시세 → 원화 변환 (티커 기준 시세 통화 사용) */
export function quotePriceToKRW(price: number, asset: Asset, exchangeRate: number): number {
  return getQuoteCurrency(asset.ticker) === 'USD' ? price * exchangeRate : price;
}

/** 한 종목의 원화 평가금액. 시세를 못 받았으면 매수 단가로 계산한다. */
export function assetValueKRW(asset: Asset, quote: Quote | undefined, exchangeRate: number): number {
  const priceKRW = quote?.price != null
    ? quotePriceToKRW(quote.price, asset, exchangeRate)
    : toKRW(asset.purchasePrice, asset.purchaseCurrency, exchangeRate);
  return priceKRW * asset.quantity;
}

/** 원 단위 금액 표기 (소수점 없음) */
export function formatKRW(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** 큰 금액을 억/만 단위로 줄여 표기 */
export function formatKorean(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
  return value.toLocaleString();
}
