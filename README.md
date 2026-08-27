# 곳간

보유 자산의 실시간 평가금액과 목표 비중, 배당을 한눈에 관리하는 Next.js 앱입니다.
시세는 Yahoo Finance에서 가져오고, 로그인하면 데이터가 [Supabase](https://supabase.com)에 저장됩니다.

**로그인 없이도 모든 화면을 그대로 쓸 수 있습니다.** 비로그인 상태의 자산·목표 비중은
브라우저 `localStorage`에 담기고, 나중에 로그인하면 Supabase로 한 번에 옮겨집니다.

## 화면

| 경로 | 화면 | 하는 일 |
| --- | --- | --- |
| `/` | 포트폴리오 | 보유 종목의 현재가·평가금액·수익률. 달러 종목은 환율로 원화 환산해 합산 |
| `/allocation` | 자산 구성 | 분류별 비중 도넛과 목표 비중 대비 괴리 |
| `/dividend` | 배당 | 보유 종목의 배당금·배당락일, 시장 관례로 추정한 지급일 |
| `/about` | 소개 | 앱 설명, 데이터 저장 위치, 시세 출처 |
| `/login` | 로그인 | 매직 링크(비밀번호 없는 이메일 링크) 발송 |

자산 분류는 해외주식 · 해외채권 · 국내주식 · 국내채권 · 대체투자 · 암호화폐 · 기타
7가지입니다 (`app/lib/portfolio.ts`).

## 빠르게 실행하기

Supabase 없이도 뜹니다. 로그인만 동작하지 않고, 데이터는 브라우저에 저장됩니다.

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 엽니다. 처음 들어오면 기본 포트폴리오가
한 번 자동으로 채워집니다 (`/api/default-assets`가 시가총액 기준으로 종목을 고릅니다).

## 로그인까지 붙이려면 — Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다.
2. **SQL Editor**에 [`supabase/schema.sql`](supabase/schema.sql)을 붙여넣고 실행합니다.
   `assets`, `allocations` 테이블과 "본인 데이터만 접근" RLS 정책이 생성됩니다.
   이미 만들어 둔 프로젝트라면 [`supabase/migrations/`](supabase/migrations)의 SQL을 순서대로 적용합니다.
3. **Authentication → Providers → Email**에서 `Enable Email provider`를 켜고,
   비밀번호 없이 쓸 것이므로 `Confirm email`은 켠 상태로 둡니다 (매직 링크가 곧 인증 링크입니다).
4. **Authentication → URL Configuration**에 아래를 등록합니다.
   - `Site URL`: 배포 주소 (예: `https://gotgan.vercel.app`)
   - `Redirect URLs`: `http://localhost:3000/auth/callback`, `https://<배포-주소>/auth/callback`

> Supabase 기본 SMTP는 시간당 발송량 제한이 빡빡합니다. 실사용 시
> **Project Settings → Authentication → SMTP Settings**에서 직접 쓰는 SMTP를 연결하세요.

### 환경 변수

[`.env.example`](.env.example)을 `.env.local`로 복사하고 값을 채웁니다.
값은 Supabase 대시보드 **Project Settings → API**에 있습니다.

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon(publishable) key — 공개되어도 되는 키이며, 접근 제어는 RLS가 담당 |

### 로그인 흐름

이메일을 입력하면 로그인 링크가 발송되고, 링크를 누르면 `/auth/callback`을 거쳐 로그인됩니다.
(PKCE `code`와 `token_hash` 양쪽을 모두 처리합니다)

브라우저 `localStorage`에 있던 자산·목표 비중은 **첫 로그인 시 자동으로 Supabase에 업로드**되고
`localStorage`에서 정리됩니다. 서버에 이미 데이터가 있으면 덮어쓰지 않습니다.

## 배포 (Vercel)

1. Vercel에 GitHub 저장소를 임포트합니다 (프레임워크 자동 감지: Next.js).
2. **Settings → Environment Variables**에 `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 Production/Preview/Development 모두에 추가합니다.
3. 배포 후 발급된 도메인을 위 Supabase 설정 **4번**의 `Site URL` / `Redirect URLs`에 반드시 등록합니다.
   등록하지 않으면 매직 링크가 `localhost`로 돌아갑니다.

> 인증 쿠키와 프록시(구 미들웨어)를 쓰므로 정적 내보내기(`output: 'export'`)로는 동작하지 않습니다.
> GitHub Pages용 워크플로는 그래서 제거했습니다.

## API

모두 서버에서 Yahoo Finance를 중계하며 사용자 데이터를 다루지 않습니다. 인증이 필요 없고,
`unstable_cache`로 응답을 재사용합니다.

| 경로 | 하는 일 | 캐시 |
| --- | --- | --- |
| `GET /api/quote` | 티커 묶음의 현재가·등락 (최대 50개, 환율 `KRW=X` 포함) | 60초 |
| `GET /api/search` | 종목 자동완성 (국내 종목·암호화폐는 내장 목록 우선, 최대 8건) | — |
| `GET /api/dividend` | 최근 1년 배당 이력과 배당락일·추정 지급일 (최대 50개) | 6시간 |
| `GET /api/default-assets` | 첫 방문자에게 채워 넣을 기본 포트폴리오 구성 | 60초 |

## 구조

| 경로 | 역할 |
| --- | --- |
| `proxy.ts` | 세션 토큰 갱신, 로그인 상태에서 `/login` 접근 시 `/`로 리다이렉트 |
| `app/login/`, `app/auth/` | 매직 링크 발송·착지, 로그아웃 서버 액션 |
| `app/components/` | 화면별 매니저 컴포넌트(자산·자산구성·배당)와 공통 UI |
| `app/lib/portfolio.ts` | 분류·통화 등 도메인 타입과 옛 분류 이름 호환 |
| `app/lib/portfolio-store.ts` | 저장소 진입점 — 로그인 여부에 따라 Supabase/localStorage로 분기 |
| `app/lib/portfolio-db.ts` | Supabase 자산·목표 비중 CRUD |
| `app/lib/portfolio-local.ts` | 비로그인 브라우저 저장소 |
| `app/lib/portfolio-migration.ts` | localStorage → Supabase 1회 마이그레이션 |
| `app/lib/portfolio-seed.ts`, `portfolio-defaults.ts` | 첫 방문자 기본 포트폴리오 1회 채우기와 후보 종목 목록 |
| `app/lib/quotes.ts` | 시세 조회·원화 환산·금액 표기 규칙 |
| `app/lib/dividend.ts` | 배당 계산(TTM 배당률, 지급일 추정) |
| `app/lib/yahoo.ts`, `app/lib/kr-assets.ts` | Yahoo Finance 호출과 국내 종목·암호화폐 이름 |
| `app/lib/supabase/` | 브라우저·서버 Supabase 클라이언트와 세션 조회 |
| `app/lib/errors.ts` | 사용자에게 보여줄 에러 메시지 정규화 |
| `app/lib/theme.ts` | 라이트/다크/시스템 테마 (첫 페인트 전 확정) |
| `supabase/` | 스키마와 마이그레이션 SQL |

## 스크립트

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run start   # 빌드 결과 실행
npm run lint    # ESLint
```

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Auth + Postgres RLS) · yahoo-finance2
