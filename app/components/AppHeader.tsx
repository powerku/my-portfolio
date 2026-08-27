'use client';

import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import { type SessionUser } from '@/app/lib/portfolio-store';
import ThemeToggle from '@/app/components/ThemeToggle';

/** 상단 탭. 화면을 추가하면 여기만 늘리면 된다. */
const TABS = [
  { href: '/', label: '포트폴리오' },
  { href: '/allocation', label: '자산 구성' },
  { href: '/dividend', label: '배당' },
] as const;

export type AppTab = (typeof TABS)[number]['href'];

/**
 * 모든 화면이 함께 쓰는 상단 바.
 *
 * 환율은 화면마다 따로 조회하므로(시세 요청에 얹어서 받는다) 값을 받아 표시만 한다.
 * 아직 못 받았으면 0을 넘겨 칩을 숨긴다.
 *
 * user가 null이면 비로그인 상태다. 이때는 로그아웃 대신 로그인 버튼을 보여준다.
 */
export default function AppHeader({
  user,
  exchangeRate,
  active,
}: {
  user: SessionUser | null;
  exchangeRate: number;
  active: AppTab;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-3.5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M4 17V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M10 17V6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M16 17v-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
            </svg>
          </span>
          <span className="hidden text-[17px] font-bold text-gray-900 sm:block">내 포트폴리오</span>
        </Link>

        <nav className="flex gap-0.5 rounded-[10px] bg-gray-100 p-0.5 text-[13px] font-semibold">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active === tab.href ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                active === tab.href
                  ? 'bg-raised text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {exchangeRate > 0 && (
            <span className="tnum chip hidden bg-gray-100 text-gray-600 sm:inline-flex">
              $1 = {exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 1 })}원
            </span>
          )}
          {user ? (
            <>
              <span className="hidden max-w-[160px] truncate text-[13px] text-gray-500 md:block">
                {user.email}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <span className="hidden text-[13px] text-gray-400 md:block">이 기기에만 저장 중</span>
              {/* 로그인 후 보고 있던 화면으로 돌아온다. */}
              <Link
                href={active === '/' ? '/login' : `/login?next=${encodeURIComponent(active)}`}
                className="btn btn-primary shrink-0 rounded-[10px] px-3.5 py-1.5 text-[13px]"
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
