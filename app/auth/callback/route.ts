import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/server';
import { authOrigin } from '@/app/lib/site';

/**
 * 매직 링크 착지 지점.
 *
 * Supabase 기본 이메일 템플릿은 PKCE `code`를 붙여서 돌려보내고,
 * 템플릿을 `{{ .TokenHash }}` 방식으로 바꾼 경우엔 `token_hash` + `type`이 온다.
 * 두 경우를 모두 처리한다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // 배포에서는 연결한 도메인, 로컬에서는 localhost:3000
  const origin = authOrigin();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const next = searchParams.get('next');
  // 오픈 리다이렉트 방지: 같은 사이트 내부 경로만 허용
  const redirectTo = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(redirectTo, origin));
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(redirectTo, origin));
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  const errorDescription = searchParams.get('error_description') ?? '로그인 링크가 올바르지 않습니다.';
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(errorDescription)}`, origin),
  );
}
