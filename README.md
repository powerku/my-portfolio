# 곳간

보유 자산의 실시간 평가금액과 목표 비중을 관리하는 Next.js 앱입니다.
로그인·자산 데이터·목표 비중은 [Supabase](https://supabase.com)에 저장되고, 시세는 Yahoo Finance에서 가져옵니다.

## 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다.
2. **SQL Editor**에 [`supabase/schema.sql`](supabase/schema.sql)을 붙여넣고 실행합니다.
   `assets`, `allocations` 테이블과 "본인 데이터만 접근" RLS 정책이 생성됩니다.
3. **Authentication → Providers → Email**에서 `Enable Email provider`를 켜고,
   비밀번호 없이 쓸 것이므로 `Confirm email`은 켠 상태로 둡니다 (매직 링크가 곧 인증 링크입니다).
4. **Authentication → URL Configuration**에 아래를 등록합니다.
   - `Site URL`: 배포 주소 (예: `https://gotgan.vercel.app`)
   - `Redirect URLs`: `http://localhost:3000/auth/callback`, `https://<배포-주소>/auth/callback`

> Supabase 기본 SMTP는 시간당 발송량 제한이 빡빡합니다. 실사용 시
> **Project Settings → Authentication → SMTP Settings**에서 직접 쓰는 SMTP를 연결하세요.

## 2. 환경 변수

[`.env.example`](.env.example)을 `.env.local`로 복사하고 값을 채웁니다.
값은 Supabase 대시보드 **Project Settings → API**에 있습니다.

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon(publishable) key — 공개되어도 되는 키이며, 접근 제어는 RLS가 담당 |

## 3. 로컬 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에 접속하면 `/login`으로 이동합니다.
이메일을 입력하면 로그인 링크가 발송되고, 링크를 누르면 `/auth/callback`을 거쳐 로그인됩니다.

기존에 브라우저 `localStorage`에 저장돼 있던 자산·목표 비중은 **첫 로그인 시 자동으로 Supabase에
업로드**되고 `localStorage`에서 정리됩니다. 서버에 이미 데이터가 있으면 덮어쓰지 않습니다.

## 4. Vercel 배포

1. Vercel에 GitHub 저장소를 임포트합니다 (프레임워크 자동 감지: Next.js).
2. **Settings → Environment Variables**에 `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 Production/Preview/Development 모두에 추가합니다.
3. 배포 후 발급된 도메인을 위 **1-4**의 `Site URL` / `Redirect URLs`에 반드시 등록합니다.
   등록하지 않으면 매직 링크가 `localhost`로 돌아갑니다.

> 이 앱은 인증 쿠키와 프록시(구 미들웨어)를 쓰므로 정적 내보내기(`output: 'export'`)로는 동작하지
> 않습니다. GitHub Pages용 워크플로는 그래서 제거했습니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `proxy.ts` | 세션 토큰 갱신 + 비로그인 접근을 `/login`으로 리다이렉트 |
| `app/login/` | 매직 링크 발송 화면 |
| `app/auth/callback/route.ts` | 매직 링크 착지 지점 (PKCE `code` / `token_hash` 모두 처리) |
| `app/auth/actions.ts` | 로그아웃 서버 액션 |
| `app/lib/supabase/` | 브라우저용 / 서버용 Supabase 클라이언트 |
| `app/lib/portfolio-db.ts` | 자산·목표 비중 CRUD |
| `app/lib/portfolio-migration.ts` | localStorage → Supabase 1회 마이그레이션 |
| `app/api/quote`, `app/api/search` | Yahoo Finance 시세·종목 검색 중계 (인증 불필요) |
