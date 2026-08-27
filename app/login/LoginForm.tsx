'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LinkError from './LinkError';
import { createClient } from '@/app/lib/supabase/client';

export default function LoginForm({ next, linkError }: { next?: string; linkError?: string | null }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const router = useRouter();

  /**
   * 로그인 링크가 이 화면으로 떨어졌을 때의 대비.
   *
   * Supabase Site URL 설정에 따라 링크가 `/auth/callback`이 아니라 `/login?code=...`로
   * 올 수 있다. 그러면 브라우저 SDK가 code를 알아서 교환하고 주소에서 code만 지우기
   * 때문에(auth-js의 detectSessionInUrl) 세션은 생겼는데 로그인 폼이 그대로 보인다.
   * 세션이 생기는 순간 화면을 넘겨준다.
   */
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      // 오픈 리다이렉트 방지: 같은 사이트 내부 경로만 허용
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      router.replace(target);
      router.refresh();
    });

    return () => data.subscription.unsubscribe();
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('이메일을 입력해주세요.');
      return;
    }

    setStatus('sending');

    const callback = new URL('/auth/callback', window.location.origin);
    if (next) callback.searchParams.set('next', next);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: callback.toString() },
    });

    if (otpError) {
      setError(otpError.message);
      setStatus('idle');
      return;
    }

    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-soft flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" aria-hidden="true">
            <rect x="3" y="5.5" width="18" height="13" rx="3" stroke="var(--color-brand)" strokeWidth="2" />
            <path d="M4.5 8l6.4 4.6a2 2 0 002.2 0L19.5 8" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-5 text-[22px] font-bold text-gray-900">메일함을 확인해주세요</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
          <span className="font-semibold text-gray-900">{email.trim()}</span> 으로
          <br />
          로그인 링크를 보냈어요. 링크를 누르면 바로 시작해요.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="btn btn-secondary btn-md mt-7 w-full"
        >
          다른 이메일로 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <LinkError initial={linkError} />

      <div>
        <label htmlFor="email" className="label">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="field text-[16px]"
        />
      </div>

      {error && <p className="text-[13px] font-medium text-up">{error}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn btn-primary btn-lg w-full">
        {status === 'sending' ? '전송 중...' : '로그인 링크 받기'}
      </button>

      <p className="pt-1 text-center text-[13px] text-gray-500">
        비밀번호는 필요 없어요. 메일로 받은 링크만 누르면 돼요.
      </p>
    </form>
  );
}
