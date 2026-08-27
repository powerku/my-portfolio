import Link from 'next/link';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export const metadata = {
  title: '로그인 · 내 포트폴리오',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const next = typeof params.next === 'string' ? params.next : undefined;

  // Supabase의 Site URL이 /login으로 잡혀 있으면 정상 링크도 이 화면으로 떨어진다.
  // 그냥 두면 로그인 폼만 보이고 세션이 안 생기므로 착지 지점으로 넘겨준다.
  const code = typeof params.code === 'string' ? params.code : null;
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : null;
  if (code || tokenHash) {
    const forward = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') forward.set(key, value);
    }
    redirect(`/auth/callback?${forward.toString()}`);
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 로그인 없이도 화면을 쓸 수 있으므로 언제든 돌아갈 길을 열어둔다. */}
      <div className="px-6 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg py-1.5 pr-2.5 text-[14px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          돌아가기
        </Link>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-14">
        <div className="w-full max-w-[400px] mx-auto">
          <div className="w-14 h-14 rounded-[18px] bg-brand flex items-center justify-center shadow-[0_8px_20px_rgba(49,130,246,0.28)]">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden="true">
              <path d="M4 17V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M10 17V6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M16 17v-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
              <path d="M20.5 4.5L14 11l-3-3-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
            </svg>
          </div>

          <h1 className="mt-7 text-[30px] font-bold leading-[1.35] text-gray-900">
            흩어진 내 자산을
            <br />
            한 화면에서 관리해요
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
            이메일만 입력하면 끝. 비밀번호 없이 로그인해요.
          </p>

          <div className="mt-9">
            <LoginForm next={next} linkError={error} />
          </div>

          <p className="mt-6 text-center text-[13px] leading-relaxed text-gray-500">
            로그인하면 이 기기에 담아둔 자산이 계정으로 옮겨져요.
            <br />
            다른 기기에서도 같은 포트폴리오를 볼 수 있어요.
          </p>
        </div>
      </div>

      <p className="px-6 pb-10 text-center text-[12px] text-gray-400">
        로그인하면 서비스 이용약관과 개인정보 처리방침에 동의하게 돼요.
      </p>
    </div>
  );
}
