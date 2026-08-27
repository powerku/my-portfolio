'use client';

import Link from 'next/link';

/**
 * 화면 전체가 그려지지 못했을 때 대신 보여주는 안내. (error.tsx가 쓴다)
 *
 * 오류의 원인은 사용자가 알 수 없고 알 필요도 없으므로, 무엇이 안 됐는지와 지금 할 수
 * 있는 일(다시 시도 / 다른 화면으로 이동)만 남긴다. 서버에서 난 오류의 메시지는 Next가
 * 감추고 digest만 넘겨주므로, 문의할 때 대조할 수 있게 그 값만 작게 적어둔다.
 */
export default function ErrorScreen({
  title,
  description,
  digest,
  onRetry,
}: {
  title: string;
  description: string;
  digest?: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="card w-full max-w-[420px] px-6 py-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-up-soft text-up">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path d="M12 8v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
            <path
              d="M12 3.5 21 19H3l9-15.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1 className="mt-5 text-[20px] font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{description}</p>

        <div className="mt-7 flex flex-col gap-2">
          <button type="button" onClick={onRetry} className="btn btn-primary btn-md w-full">
            다시 시도
          </button>
          <Link href="/" className="btn btn-secondary btn-md w-full">
            포트폴리오로 가기
          </Link>
        </div>

        {digest && <p className="mt-5 text-[12px] text-gray-400">오류 코드: {digest}</p>}
      </div>
    </main>
  );
}
