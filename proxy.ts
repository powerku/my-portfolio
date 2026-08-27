import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 만료된 세션 토큰을 갱신해 응답 쿠키에 실어 보낸다.
 * (Next.js 16부터 middleware 파일 규약은 proxy로 이름이 바뀌었다.)
 *
 * 모든 화면은 로그인 없이도 열린다. (비로그인 데이터는 localStorage에 담긴다)
 * 그래서 여기서 막는 건 이미 로그인한 사용자의 /login 접근뿐이다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getUser()를 호출해야 토큰 갱신이 일어난다. 이 호출을 빼면 세션이 임의로 끊긴다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 정적 파일 / 이미지 최적화 / api 를 제외한 모든 경로.
     * /api/* 는 야후 파이낸스 시세만 중계하고 사용자 데이터를 다루지 않으므로 제외했다.
     * (제외하지 않으면 시세 요청 하나마다 세션 검증 왕복이 한 번씩 더 붙는다.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
