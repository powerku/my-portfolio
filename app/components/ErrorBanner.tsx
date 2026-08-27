'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ErrorNotice } from '@/app/lib/errors';

/**
 * 화면 위쪽에 띄우는 오류 띠.
 *
 * 이미 그려진 화면은 그대로 두고 잘못된 것만 알린다. (자산 목록은 남겨두고 "저장하지
 * 못했습니다"만 얹는 식) 그래서 화면을 통째로 갈아 끼우는 error.tsx와 쓰임이 다르다.
 *
 * 사용자가 할 수 있는 일이 있으면 버튼으로 함께 준다. 세션이 끊긴 경우엔 다시 로그인,
 * 그 밖에는 (호출부가 방법을 넘겨줬다면) 다시 시도다.
 */
export default function ErrorBanner({
  notice,
  onRetry,
}: {
  notice: ErrorNotice;
  onRetry?: () => void;
}) {
  const pathname = usePathname();
  // 로그인 후 보고 있던 화면으로 돌아온다. (AppHeader의 로그인 버튼과 같은 규칙)
  const loginHref = pathname && pathname !== '/' ? `/login?next=${encodeURIComponent(pathname)}` : '/login';

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-up-soft px-4 py-3 text-[14px] font-medium text-up"
    >
      <span className="min-w-0 flex-1">{notice.message}</span>

      {notice.sessionExpired ? (
        <Link
          href={loginHref}
          className="btn shrink-0 rounded-[10px] bg-up px-3 py-1.5 text-[13px] text-white hover:opacity-90"
        >
          다시 로그인
        </Link>
      ) : (
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn shrink-0 rounded-[10px] bg-up px-3 py-1.5 text-[13px] text-white hover:opacity-90"
          >
            다시 시도
          </button>
        )
      )}
    </div>
  );
}
