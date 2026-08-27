'use client';

import { useSyncExternalStore } from 'react';

/**
 * 로그인 링크 오류 안내.
 *
 * Supabase는 링크 검증에 실패하면 오류를 쿼리가 아니라 프래그먼트로 붙여 보낸다.
 * (`/login#error=access_denied&error_code=otp_expired...`) 프래그먼트는 서버로
 * 전송되지 않으므로, 서버에서 읽은 `?error=`와 별개로 브라우저에서 한 번 더 읽는다.
 *
 * 주소창의 프래그먼트는 지우지 않는다. 새로고침해도 같은 안내가 보이는 편이 낫고,
 * 새 링크를 요청하면 이 안내를 감싼 폼 자체가 사라진다.
 */
const MESSAGES: Record<string, string> = {
  otp_expired: '로그인 링크가 만료됐어요. 새 링크를 받아 5분 안에 눌러주세요.',
  access_denied: '이미 사용했거나 유효하지 않은 링크예요. 새 링크를 받아주세요.',
};

/** location.hash는 리액트 밖의 값이라 외부 저장소로 읽는다. (서버에서는 빈 문자열) */
function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getSnapshot() {
  return window.location.hash;
}

function getServerSnapshot() {
  return '';
}

function messageFromHash(hash: string): string | null {
  if (!hash) return null;

  const params = new URLSearchParams(hash.slice(1));
  const code = params.get('error_code');
  const error = params.get('error');
  if (!code && !error) return null;

  return (
    MESSAGES[code ?? ''] ??
    MESSAGES[error ?? ''] ??
    params.get('error_description') ??
    '로그인 링크가 올바르지 않습니다.'
  );
}

export default function LinkError({ initial }: { initial?: string | null }) {
  const message = messageFromHash(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)) ?? initial;
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-2xl bg-up-soft px-4 py-3 text-[14px] font-medium text-up">
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </div>
  );
}
