/**
 * 배당 정보의 공용 타입과 표기 규칙.
 *
 * 서버(`/api/dividend`)가 Yahoo Finance 배당 이력에서 뽑아낸 값을 화면이 그대로
 * 쓰도록 한 곳에 모아둔다.
 */

/** 배당 실적을 볼 기간(일). "연간 배당"은 모두 이 기간의 합계를 뜻한다. */
export const TTM_DAYS = 365;

export interface DividendInfo {
  ticker: string;
  /** 배당금과 주가의 통화 (Yahoo 차트 메타 기준) */
  currency: string;
  /** 최근 1년 주당 배당금 합계 */
  annualPerShare: number;
  /** 가장 최근에 지급한 1회분 주당 배당금 */
  lastPerShare: number | null;
  /** 가장 최근 배당락일 (YYYY-MM-DD) */
  lastExDate: string | null;
  /** 다음 배당락일 (YYYY-MM-DD). 배당 이력이 없으면 null */
  nextExDate: string | null;
  /** 다음 배당락일이 주기로 추정한 값인지. Yahoo가 확정 일자를 주면 false */
  nextExDateEstimated: boolean;
  /** 다음 배당 지급일 (YYYY-MM-DD). 다음 배당락일을 모르면 null */
  nextPayDate: string | null;
  /** 다음 배당 지급일이 배당락일~지급일 간격으로 추정한 값인지 */
  nextPayDateEstimated: boolean;
  /** 최근 1년 배당 지급 횟수. 0이면 배당 이력이 없다. */
  paymentsPerYear: number;
  /** 1~12월 주당 배당금 (최근 1년 실적을 배당 지급일이 속한 달로 모은 값, 길이 12) */
  monthlyPerShare: number[];
  /** 1~12월 배당 지급일 (YYYY-MM-DD, 길이 12). 그 달에 배당이 없으면 null이고, 모두 어림값이다. */
  monthlyPayDate: (string | null)[];
}

/**
 * 지급 횟수로 읽는 배당 주기.
 *
 * 월 배당은 배당락일이 월말에 몰려 1년 안에 13번으로 집계될 수 있어 11회 이상을
 * 한 묶음으로 본다. 그 밖에는 흔한 주기(1·2·4회)만 이름을 주고 나머지는 횟수로
 * 표기해 실제 이력과 어긋나지 않게 한다.
 */
export function frequencyLabel(paymentsPerYear: number): string {
  if (paymentsPerYear <= 0) return '배당 없음';
  if (paymentsPerYear >= 11) return '월 배당';
  if (paymentsPerYear === 4) return '분기 배당';
  if (paymentsPerYear === 2) return '반기 배당';
  if (paymentsPerYear === 1) return '연 1회';
  return `연 ${paymentsPerYear}회`;
}

/** 배당금 표기. 통화별로 자릿수가 달라 여기서 함께 관리한다. */
export function formatPerShare(amount: number, currency: string): string {
  if (currency === 'KRW') return `${Math.round(amount).toLocaleString()}원`;
  if (currency === 'USD') {
    // 주당 배당금은 $0.271처럼 소수 셋째 자리까지 의미가 있다.
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return currency ? `${formatted} ${currency}` : formatted;
}

/** 오늘 날짜를 `YYYY-MM-DD`로. 배당락일과 같은 형식이라 문자열로 바로 견줄 수 있다. */
export function todayKey(): string {
  const now = new Date();
  // 배당락일은 현지 날짜이므로 UTC가 아닌 기기 시간대의 날짜를 쓴다.
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 오늘부터 그 날짜까지 남은 날수. 오늘이면 0, 지난 날짜면 음수. */
export function daysUntil(dateKey: string, today: string = todayKey()): number {
  const toUTC = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUTC(dateKey) - toUTC(today)) / (24 * 60 * 60 * 1000));
}

/** 남은 날수 표기. 당일은 D-0보다 '오늘'이 바로 읽힌다. */
export function dDayLabel(days: number): string {
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  if (days > 0) return `D-${days}`;
  return `${-days}일 지남`;
}

/** `YYYY-MM-DD` → `2026. 8. 10.` (월·일만 쓰는 화면을 위해 연도는 선택) */
export function formatExDate(dateKey: string, options: { withYear?: boolean } = {}): string {
  const [year, month, day] = dateKey.split('-');
  return options.withYear ? `${year}. ${Number(month)}. ${Number(day)}.` : `${Number(month)}월 ${Number(day)}일`;
}
