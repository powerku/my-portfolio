'use client';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';

export default function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

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
            <rect x="3" y="5.5" width="18" height="13" rx="3" stroke="#3182f6" strokeWidth="2" />
            <path d="M4.5 8l6.4 4.6a2 2 0 002.2 0L19.5 8" stroke="#3182f6" strokeWidth="2" strokeLinecap="round" />
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
