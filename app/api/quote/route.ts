import YahooFinance from 'yahoo-finance2';
import { type NextRequest } from 'next/server';

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');

  if (!ticker) {
    return Response.json({ error: 'ticker 파라미터가 필요합니다.' }, { status: 400 });
  }

  try {
    const quote = await yahooFinance.quote(ticker);
    return Response.json({
      ticker,
      shortName: quote.shortName ?? ticker,
      price: quote.regularMarketPrice ?? null,
      change: quote.regularMarketChange ?? null,
      changePercent: quote.regularMarketChangePercent ?? null,
    });
  } catch {
    return Response.json({ error: '시세를 불러오는 데 실패했습니다.' }, { status: 500 });
  }
}
