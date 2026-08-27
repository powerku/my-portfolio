/**
 * 오류를 화면에 보여줄 형태로 바꾸는 규칙.
 *
 * 여기서 특별히 갈라내는 건 "세션 만료"다. 로그인 토큰이 만료된 채로 요청이 나가면
 * Supabase는 `JWT expired` / `Auth session missing!` 같은 영문 메시지를 돌려주는데,
 * 이걸 그대로 띄우면 사용자는 무엇을 해야 할지 알 수 없다. 이 경우에 필요한 안내는
 * 하나뿐이라 문구도 하나로 고정하고, 화면은 다시 로그인 버튼을 함께 보여준다.
 */

export const SESSION_EXPIRED_MESSAGE = '로그인이 풀렸어요. 다시 로그인하면 이어서 볼 수 있어요.';

/** 토큰을 새로 받아봐도 살아나지 않은 세션. 다시 로그인하는 것 말고는 방법이 없다. */
export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = 'SessionExpiredError';
  }
}

/** 오류 객체에서 읽어낸 message. Supabase의 PostgrestError는 Error 인스턴스가 아니다. */
function messageOf(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return '';
}

function fieldOf(e: unknown, key: 'code' | 'status'): string {
  if (!e || typeof e !== 'object') return '';
  const value = (e as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** PostgREST가 토큰 문제로 요청을 막았을 때의 코드 (만료·검증 실패) */
const AUTH_ERROR_CODES = new Set(['PGRST301', 'PGRST302', '401']);

/**
 * 토큰이 없거나 만료돼서 생긴 오류인지.
 *
 * 라이브러리마다 오류 모양이 달라(auth-js는 AuthError, PostgREST는 `{ code, message }`,
 * 게이트웨이는 401) 한 가지 기준으로는 잡히지 않는다. 세 갈래를 모두 본다.
 */
export function isAuthError(e: unknown): boolean {
  if (e instanceof SessionExpiredError) return true;
  if (!e || typeof e !== 'object') return false;

  // auth-js가 던지는 오류는 전부 이 표시를 달고 있다. (AuthError.__isAuthError)
  if ('__isAuthError' in e) return true;

  if (AUTH_ERROR_CODES.has(fieldOf(e, 'code')) || fieldOf(e, 'status') === '401') return true;

  const message = messageOf(e).toLowerCase();
  return [
    'jwt',
    'auth session missing',
    'session_not_found',
    'refresh token',
    'missing sub claim',
    'no api key',
    'unauthorized',
  ].some((hint) => message.includes(hint));
}

/**
 * 에러를 화면에 띄울 문구로 변환.
 * Supabase의 PostgrestError는 Error 인스턴스가 아니라 `{ message, ... }` 객체다.
 */
export function toMessage(e: unknown, fallback: string): string {
  if (isAuthError(e)) return SESSION_EXPIRED_MESSAGE;

  const detail = messageOf(e);
  return detail ? `${fallback} (${detail})` : fallback;
}

/** 화면 위쪽 띠(ErrorBanner)에 그대로 넘기는 오류 안내 */
export interface ErrorNotice {
  message: string;
  /** 다시 로그인해야 풀리는 오류인지. 띠에 로그인 버튼을 붙일지 정한다. */
  sessionExpired: boolean;
  /** 다시 불러오면 풀릴 만한 오류인지. 데이터를 읽다 실패한 경우에만 켠다. */
  retryable?: boolean;
}

export function toNotice(e: unknown, fallback: string): ErrorNotice {
  return { message: toMessage(e, fallback), sessionExpired: isAuthError(e) };
}
