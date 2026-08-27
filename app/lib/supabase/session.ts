import { SessionExpiredError, isAuthError } from '@/app/lib/errors';
import { createClient } from '@/app/lib/supabase/client';

/** Supabase 호출의 공통 응답 모양. 데이터 조회(PostgREST)와 인증 호출이 같다. */
interface SupabaseResult<T> {
  data: T | null;
  error: unknown;
}

/**
 * 토큰이 만료된 채로 나간 요청을 한 번만 되살린다.
 *
 * 브라우저 탭이 절전으로 오래 멈춰 있었거나 다른 탭에서 토큰이 갱신되면, 이 탭이 들고
 * 있는 액세스 토큰이 만료된 상태로 요청이 나가 `JWT expired` 같은 오류를 받는다.
 * 이때 세션 자체는 살아 있으므로 토큰을 새로 받아 같은 요청을 한 번 더 보내면 된다.
 * (`refreshSession`은 새 토큰을 쿠키에도 써서 다음 서버 렌더링까지 맞춰준다)
 *
 * 갱신마저 실패하면 다시 로그인하는 수밖에 없으므로 SessionExpiredError로 바꿔 던진다.
 * 인증과 무관한 오류는 손대지 않고 그대로 올려보낸다.
 *
 * @param run 호출할 때마다 요청을 새로 만들어야 한다. (같은 빌더를 두 번 await 하지 않도록)
 */
export async function withAuthRetry<T>(run: () => PromiseLike<SupabaseResult<T>>): Promise<T | null> {
  const first = await run();
  if (!first.error) return first.data;
  if (!isAuthError(first.error)) throw first.error;

  const supabase = createClient();
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) throw new SessionExpiredError();

  const second = await run();
  if (second.error) {
    throw isAuthError(second.error) ? new SessionExpiredError() : second.error;
  }
  return second.data;
}
