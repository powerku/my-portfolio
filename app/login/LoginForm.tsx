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
      <div className="space-y-3 text-center">
        <p className="text-4xl">📮</p>
        <h2 className="text-lg font-semibold">메일함을 확인해주세요</h2>
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">{email.trim()}</span> 으로 로그인 링크를 보냈습니다.
          <br />
          링크를 클릭하면 바로 로그인됩니다.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="text-sm text-blue-600 hover:underline"
        >
          다른 이메일로 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-gray-600 mb-1">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'sending' ? '전송 중...' : '로그인 링크 받기'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        비밀번호는 필요 없습니다. 메일로 받은 링크를 클릭하면 로그인됩니다.
      </p>
    </form>
  );
}
